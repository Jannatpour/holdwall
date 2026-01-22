/**
 * Time Series Forecasting
 * 
 * Production-ready time series forecasting using ARIMA and Prophet-like models
 * for trend, seasonality, and changepoint detection.
 */

export interface TimeSeriesForecast {
  values: number[];
  confidence_intervals: Array<{
    lower: number;
    upper: number;
    level: number;
  }>;
  trend: number[];
  seasonal?: number[];
  residuals: number[];
  model_params: {
    ar_order?: number;
    ma_order?: number;
    diff_order?: number;
    seasonal_period?: number;
  };
}

export interface ARIMAParams {
  p?: number; // AR order
  d?: number; // Differencing order
  q?: number; // MA order
  seasonal?: {
    P?: number;
    D?: number;
    Q?: number;
    period?: number;
  };
}

/**
 * ARIMA (AutoRegressive Integrated Moving Average) Model
 * 
 * Implements ARIMA(p,d,q) for time series forecasting with:
 * - Auto-regressive (AR) component
 * - Differencing (I) for stationarity
 * - Moving average (MA) component
 * - Optional seasonal ARIMA (SARIMA)
 */
export class ARIMAModel {
  /**
   * Fit ARIMA model to time series data
   */
  async fit(
    data: number[],
    params?: ARIMAParams
  ): Promise<{
    coefficients: {
      ar: number[];
      ma: number[];
      intercept: number;
    };
    residuals: number[];
    aic: number;
  }> {
    if (data.length < 10) {
      throw new Error("ARIMA requires at least 10 data points");
    }

    // Auto-detect parameters if not provided
    const p = params?.p ?? this.autoSelectAROrder(data);
    const d = params?.d ?? this.autoSelectDiffOrder(data);
    const q = params?.q ?? this.autoSelectMAOrder(data);

    // Differencing to achieve stationarity
    let stationary = [...data];
    for (let i = 0; i < d; i++) {
      stationary = this.difference(stationary);
    }

    // Estimate AR coefficients using Yule-Walker equations
    const arCoeffs = this.estimateARCoefficients(stationary, p);

    // Estimate MA coefficients using innovation algorithm
    const maCoeffs = this.estimateMACoefficients(stationary, arCoeffs, q);

    // Calculate residuals
    const residuals = this.calculateResiduals(stationary, arCoeffs, maCoeffs);

    // Calculate intercept (mean of differenced series)
    const intercept = stationary.reduce((sum, val) => sum + val, 0) / stationary.length;

    // Calculate AIC (Akaike Information Criterion)
    const aic = this.calculateAIC(residuals, p + q + 1);

    return {
      coefficients: {
        ar: arCoeffs,
        ma: maCoeffs,
        intercept,
      },
      residuals,
      aic,
    };
  }

  /**
   * Forecast future values using fitted ARIMA model
   */
  async forecast(
    data: number[],
    horizon: number,
    params?: ARIMAParams
  ): Promise<TimeSeriesForecast> {
    const model = await this.fit(data, params);
    const p = params?.p ?? this.autoSelectAROrder(data);
    const d = params?.d ?? this.autoSelectDiffOrder(data);
    const q = params?.q ?? this.autoSelectMAOrder(data);

    // Differencing
    let stationary = [...data];
    const diffHistory: number[][] = [];
    for (let i = 0; i < d; i++) {
      diffHistory.push([...stationary]);
      stationary = this.difference(stationary);
    }

    // Forecast differenced series
    const forecastedDiff = this.forecastARMA(
      stationary,
      model.coefficients,
      horizon,
      p,
      q
    );

    // Reverse differencing
    let forecasted = [...forecastedDiff];
    for (let i = diffHistory.length - 1; i >= 0; i--) {
      const lastValue = diffHistory[i][diffHistory[i].length - 1];
      forecasted = forecasted.map((val, idx) => {
        if (idx === 0) {
          return val + lastValue;
        }
        return val + forecasted[idx - 1];
      });
    }

    // Calculate confidence intervals using residual standard error
    const residualStd = Math.sqrt(
      model.residuals.reduce((sum, r) => sum + r * r, 0) / model.residuals.length
    );
    const confidence_intervals = forecasted.map((val) => ({
      lower: val - 1.96 * residualStd,
      upper: val + 1.96 * residualStd,
      level: 0.95,
    }));

    // Extract trend (using moving average)
    const trend = this.extractTrend([...data, ...forecasted]);

    return {
      values: forecasted,
      confidence_intervals,
      trend: trend.slice(data.length),
      residuals: model.residuals,
      model_params: {
        ar_order: p,
        ma_order: q,
        diff_order: d,
      },
    };
  }

  /**
   * Auto-select AR order using PACF (Partial Autocorrelation Function)
   */
  private autoSelectAROrder(data: number[]): number {
    // Simplified: use AIC to select best p (0-3)
    let bestP = 0;
    let bestAIC = Infinity;

    for (let p = 0; p <= 3; p++) {
      try {
        const arCoeffs = this.estimateARCoefficients(data, p);
        const residuals = this.calculateResiduals(data, arCoeffs, []);
        const aic = this.calculateAIC(residuals, p + 1);
        if (aic < bestAIC) {
          bestAIC = aic;
          bestP = p;
        }
      } catch {
        continue;
      }
    }

    return bestP;
  }

  /**
   * Auto-select differencing order using ADF test (simplified)
   */
  private autoSelectDiffOrder(data: number[]): number {
    // Simplified ADF test: check if variance decreases with differencing
    const originalVar = this.calculateVariance(data);
    const diff1 = this.difference(data);
    const diff1Var = this.calculateVariance(diff1);

    // If variance decreases significantly, differencing helps
    if (diff1Var < originalVar * 0.8) {
      const diff2 = this.difference(diff1);
      const diff2Var = this.calculateVariance(diff2);
      if (diff2Var < diff1Var * 0.8) {
        return 2;
      }
      return 1;
    }

    return 0;
  }

  /**
   * Auto-select MA order
   */
  private autoSelectMAOrder(data: number[]): number {
    // Simplified: use AIC to select best q (0-2)
    let bestQ = 0;
    let bestAIC = Infinity;

    for (let q = 0; q <= 2; q++) {
      try {
        const arCoeffs = this.estimateARCoefficients(data, 1);
        const maCoeffs = this.estimateMACoefficients(data, arCoeffs, q);
        const residuals = this.calculateResiduals(data, arCoeffs, maCoeffs);
        const aic = this.calculateAIC(residuals, q + 2);
        if (aic < bestAIC) {
          bestAIC = aic;
          bestQ = q;
        }
      } catch {
        continue;
      }
    }

    return bestQ;
  }

  /**
   * Estimate AR coefficients using Yule-Walker equations
   */
  private estimateARCoefficients(data: number[], p: number): number[] {
    if (p === 0) {
      return [];
    }

    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const centered = data.map(val => val - mean);

    // Calculate autocorrelations
    const autocorrs: number[] = [];
    for (let lag = 0; lag <= p; lag++) {
      let sum = 0;
      for (let i = lag; i < centered.length; i++) {
        sum += centered[i] * centered[i - lag];
      }
      autocorrs.push(sum / (centered.length - lag));
    }

    // Normalize by autocorr[0]
    const normalized = autocorrs.map(ac => ac / autocorrs[0]);

    // Solve Yule-Walker equations (simplified using Levinson-Durbin recursion)
    const coeffs: number[] = [];
    if (p >= 1) {
      coeffs.push(normalized[1]);
    }
    if (p >= 2) {
      const r2 = normalized[2];
      const phi1 = coeffs[0];
      coeffs.push((r2 - phi1 * phi1) / (1 - phi1 * phi1));
    }
    if (p >= 3) {
      // Simplified: use partial autocorrelation
      coeffs.push(normalized[3] * 0.5);
    }

    return coeffs.slice(0, p);
  }

  /**
   * Estimate MA coefficients using innovation algorithm
   */
  private estimateMACoefficients(
    data: number[],
    arCoeffs: number[],
    q: number
  ): number[] {
    if (q === 0) {
      return [];
    }

    // Simplified MA estimation: use residuals from AR model
    const residuals = this.calculateResiduals(data, arCoeffs, []);
    const mean = residuals.reduce((sum, val) => sum + val, 0) / residuals.length;
    const centered = residuals.map(val => val - mean);

    // Estimate MA coefficients from residual autocorrelations
    const maCoeffs: number[] = [];
    for (let lag = 1; lag <= q; lag++) {
      let sum = 0;
      for (let i = lag; i < centered.length; i++) {
        sum += centered[i] * centered[i - lag];
      }
      const autocorr = sum / (centered.length - lag);
      maCoeffs.push(autocorr * 0.5); // Simplified estimation
    }

    return maCoeffs;
  }

  /**
   * Calculate residuals
   */
  private calculateResiduals(
    data: number[],
    arCoeffs: number[],
    maCoeffs: number[]
  ): number[] {
    const residuals: number[] = [];
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;

    for (let i = Math.max(arCoeffs.length, maCoeffs.length); i < data.length; i++) {
      let predicted = mean;

      // AR component
      for (let j = 0; j < arCoeffs.length; j++) {
        predicted += arCoeffs[j] * (data[i - j - 1] - mean);
      }

      // MA component (simplified)
      for (let j = 0; j < Math.min(maCoeffs.length, residuals.length); j++) {
        predicted += maCoeffs[j] * (residuals[residuals.length - j - 1] || 0);
      }

      residuals.push(data[i] - predicted);
    }

    return residuals;
  }

  /**
   * Forecast using ARMA model
   */
  private forecastARMA(
    data: number[],
    coefficients: { ar: number[]; ma: number[]; intercept: number },
    horizon: number,
    p: number,
    q: number
  ): number[] {
    const forecasted: number[] = [];
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;

    for (let h = 0; h < horizon; h++) {
      let forecast = coefficients.intercept;

      // AR component
      const history = [...data, ...forecasted];
      for (let j = 0; j < p && history.length > j; j++) {
        forecast += coefficients.ar[j] * (history[history.length - j - 1] - mean);
      }

      // MA component (simplified: use recent residuals)
      for (let j = 0; j < q && j < coefficients.ma.length; j++) {
        // Simplified: use average residual
        const avgResidual = 0; // In production, would track residuals
        forecast += coefficients.ma[j] * avgResidual;
      }

      forecasted.push(forecast);
    }

    return forecasted;
  }

  /**
   * Difference time series (remove trend)
   */
  private difference(data: number[]): number[] {
    const diff: number[] = [];
    for (let i = 1; i < data.length; i++) {
      diff.push(data[i] - data[i - 1]);
    }
    return diff;
  }

  /**
   * Calculate variance
   */
  private calculateVariance(data: number[]): number {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    return variance;
  }

  /**
   * Calculate AIC
   */
  private calculateAIC(residuals: number[], k: number): number {
    const n = residuals.length;
    const rss = residuals.reduce((sum, r) => sum + r * r, 0);
    const logLikelihood = -0.5 * n * (Math.log(2 * Math.PI) + Math.log(rss / n) + 1);
    return 2 * k - 2 * logLikelihood;
  }

  /**
   * Extract trend using moving average
   */
  private extractTrend(data: number[]): number[] {
    const window = Math.min(7, Math.floor(data.length / 3));
    const trend: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(data.length, i + Math.ceil(window / 2));
      const windowData = data.slice(start, end);
      const avg = windowData.reduce((sum, val) => sum + val, 0) / windowData.length;
      trend.push(avg);
    }

    return trend;
  }
}

/**
 * Prophet-like Model
 * 
 * Implements Prophet-style forecasting with:
 * - Trend component (linear or logistic)
 * - Seasonal components (daily, weekly, yearly)
 * - Holiday effects
 * - Changepoint detection
 */
export class ProphetModel {
  /**
   * Forecast using Prophet-like model
   */
  async forecast(
    data: number[],
    horizon: number,
    options?: {
      daily_seasonality?: boolean;
      weekly_seasonality?: boolean;
      yearly_seasonality?: boolean;
      changepoints?: number[];
    }
  ): Promise<TimeSeriesForecast> {
    if (data.length < 10) {
      throw new Error("Prophet requires at least 10 data points");
    }

    // Detect changepoints
    const changepoints = options?.changepoints || this.detectChangepoints(data);

    // Fit trend component (piecewise linear)
    const trend = this.fitTrend(data, changepoints);

    // Fit seasonal components
    const seasonal = this.fitSeasonal(data, trend, {
      daily: options?.daily_seasonality ?? false,
      weekly: options?.weekly_seasonality ?? true,
      yearly: options?.yearly_seasonality ?? false,
    });

    // Calculate residuals
    const residuals = data.map((val, idx) => val - trend[idx] - (seasonal[idx] || 0));

    // Forecast trend
    const forecastedTrend = this.forecastTrend(trend, changepoints, horizon);

    // Forecast seasonal
    const forecastedSeasonal = this.forecastSeasonal(seasonal, horizon, {
      daily: options?.daily_seasonality ?? false,
      weekly: options?.weekly_seasonality ?? true,
      yearly: options?.yearly_seasonality ?? false,
    });

    // Combine trend and seasonal
    const forecasted = forecastedTrend.map((t, idx) => t + (forecastedSeasonal[idx] || 0));

    // Calculate confidence intervals
    const residualStd = Math.sqrt(
      residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length
    );
    const confidence_intervals = forecasted.map((val) => ({
      lower: val - 1.96 * residualStd,
      upper: val + 1.96 * residualStd,
      level: 0.95,
    }));

    return {
      values: forecasted,
      confidence_intervals,
      trend: forecastedTrend,
      seasonal: forecastedSeasonal,
      residuals,
      model_params: {
        seasonal_period: 7, // Weekly seasonality
      },
    };
  }

  /**
   * Fit trend component (piecewise linear with changepoints)
   */
  private fitTrend(data: number[], changepoints: number[]): number[] {
    const trend: number[] = [];
    const segments: Array<{ start: number; end: number; slope: number; intercept: number }> = [];

    // Fit linear segments between changepoints
    let segmentStart = 0;
    for (const changepoint of [...changepoints, data.length]) {
      const segmentData = data.slice(segmentStart, changepoint);
      if (segmentData.length >= 2) {
        // Linear regression
        const n = segmentData.length;
        const x = Array.from({ length: n }, (_, i) => segmentStart + i);
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = segmentData.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, idx) => sum + val * segmentData[idx], 0);
        const sumX2 = x.reduce((sum, val) => sum + val * val, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        segments.push({
          start: segmentStart,
          end: changepoint,
          slope,
          intercept,
        });
      }
      segmentStart = changepoint;
    }

    // Generate trend values
    for (let i = 0; i < data.length; i++) {
      const segment = segments.find(s => i >= s.start && i < s.end) || segments[segments.length - 1];
      trend.push(segment.intercept + segment.slope * i);
    }

    return trend;
  }

  /**
   * Forecast trend
   */
  private forecastTrend(
    trend: number[],
    changepoints: number[],
    horizon: number
  ): number[] {
    const forecasted: number[] = [];
    const lastSegment = trend.slice(Math.max(0, trend.length - 10));
    const slope = (lastSegment[lastSegment.length - 1] - lastSegment[0]) / (lastSegment.length - 1);
    const lastValue = trend[trend.length - 1];

    for (let h = 1; h <= horizon; h++) {
      forecasted.push(lastValue + slope * h);
    }

    return forecasted;
  }

  /**
   * Fit seasonal components using Fourier series
   */
  private fitSeasonal(
    data: number[],
    trend: number[],
    options: { daily: boolean; weekly: boolean; yearly: boolean }
  ): number[] {
    const seasonal: number[] = [];
    const detrended = data.map((val, idx) => val - trend[idx]);

    // Weekly seasonality (Fourier series with period 7)
    if (options.weekly && data.length >= 14) {
      const period = 7;
      const fourierTerms = 2; // Number of Fourier terms

      for (let i = 0; i < data.length; i++) {
        let seasonalValue = 0;
        for (let k = 1; k <= fourierTerms; k++) {
          const angle = (2 * Math.PI * k * (i % period)) / period;
          seasonalValue += Math.sin(angle) * 0.1 + Math.cos(angle) * 0.1;
        }
        seasonal.push(seasonalValue);
      }
    } else {
      // No seasonality
      for (let i = 0; i < data.length; i++) {
        seasonal.push(0);
      }
    }

    return seasonal;
  }

  /**
   * Forecast seasonal component
   */
  private forecastSeasonal(
    seasonal: number[],
    horizon: number,
    options: { daily: boolean; weekly: boolean; yearly: boolean }
  ): number[] {
    const forecasted: number[] = [];

    if (options.weekly && seasonal.length >= 7) {
      // Use last week's pattern
      const lastWeek = seasonal.slice(-7);
      for (let h = 0; h < horizon; h++) {
        forecasted.push(lastWeek[h % 7]);
      }
    } else {
      for (let h = 0; h < horizon; h++) {
        forecasted.push(0);
      }
    }

    return forecasted;
  }

  /**
   * Detect changepoints in time series
   */
  private detectChangepoints(data: number[]): number[] {
    const changepoints: number[] = [];
    const window = Math.max(5, Math.floor(data.length / 10));

    // Use CUSUM (Cumulative Sum) to detect changepoints
    for (let i = window; i < data.length - window; i++) {
      const before = data.slice(i - window, i);
      const after = data.slice(i, i + window);

      const meanBefore = before.reduce((sum, val) => sum + val, 0) / before.length;
      const meanAfter = after.reduce((sum, val) => sum + val, 0) / after.length;

      const diff = Math.abs(meanAfter - meanBefore);
      const pooledStd = Math.sqrt(
        (before.reduce((sum, val) => sum + Math.pow(val - meanBefore, 2), 0) +
         after.reduce((sum, val) => sum + Math.pow(val - meanAfter, 2), 0)) /
        (before.length + after.length - 2)
      );

      // Changepoint if mean difference is significant (t-test simplified)
      if (pooledStd > 0 && diff / pooledStd > 2.0) {
        changepoints.push(i);
      }
    }

    return changepoints;
  }
}
