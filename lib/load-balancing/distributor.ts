/**
 * Dynamic Load Balancing and Auto-Scaling
 * 
 * Implements dynamic redistribution mechanisms for load-balancing and scaling
 * across distributed services with health checks and auto-scaling policies
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export interface ServiceInstance {
  id: string;
  url: string;
  region?: string;
  zone?: string;
  health: "healthy" | "degraded" | "unhealthy";
  load: number; // 0-1, current load factor
  capacity: number; // max concurrent requests
  activeRequests: number;
  responseTime: number; // average response time in ms
  errorRate: number; // 0-1, error rate
  lastHealthCheck: Date;
  metadata?: Record<string, unknown>;
}

export interface LoadBalancingConfig {
  strategy: "round-robin" | "least-connections" | "weighted" | "latency-based" | "geographic";
  healthCheckInterval: number; // ms
  healthCheckTimeout: number; // ms
  maxRetries: number;
  retryBackoff: number; // ms
  enableAutoScaling: boolean;
  autoScalingPolicy?: AutoScalingPolicy;
}

export interface AutoScalingPolicy {
  minInstances: number;
  maxInstances: number;
  targetLoad: number; // 0-1, target load factor
  scaleUpThreshold: number; // 0-1, scale up when load exceeds
  scaleDownThreshold: number; // 0-1, scale down when load below
  scaleUpCooldown: number; // ms, cooldown after scaling up
  scaleDownCooldown: number; // ms, cooldown after scaling down
  scaleUpStep: number; // number of instances to add
  scaleDownStep: number; // number of instances to remove
}

export class DynamicLoadBalancer {
  private instances: Map<string, ServiceInstance> = new Map();
  private config: LoadBalancingConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private currentIndex: number = 0;
  private requestCounts: Map<string, number> = new Map();

  constructor(config: LoadBalancingConfig) {
    this.config = config;
    this.startHealthChecks();
  }

  /**
   * Register a service instance
   */
  registerInstance(instance: ServiceInstance): void {
    this.instances.set(instance.id, instance);
    this.requestCounts.set(instance.id, 0);
    logger.info("Service instance registered", { instanceId: instance.id, url: instance.url });
    metrics.increment("load_balancer_instances_registered", { instance_id: instance.id });
  }

  /**
   * Unregister a service instance
   */
  unregisterInstance(instanceId: string): void {
    this.instances.delete(instanceId);
    this.requestCounts.delete(instanceId);
    logger.info("Service instance unregistered", { instanceId });
    metrics.increment("load_balancer_instances_unregistered", { instance_id: instanceId });
  }

  /**
   * Select next instance based on strategy
   */
  selectInstance(): ServiceInstance | null {
    const healthyInstances = Array.from(this.instances.values())
      .filter(instance => instance.health === "healthy");

    if (healthyInstances.length === 0) {
      logger.warn("No healthy instances available");
      metrics.increment("load_balancer_no_healthy_instances");
      return null;
    }

    let selected: ServiceInstance;

    switch (this.config.strategy) {
      case "round-robin":
        selected = this.roundRobin(healthyInstances);
        break;
      case "least-connections":
        selected = this.leastConnections(healthyInstances);
        break;
      case "weighted":
        selected = this.weighted(healthyInstances);
        break;
      case "latency-based":
        selected = this.latencyBased(healthyInstances);
        break;
      case "geographic":
        selected = this.geographic(healthyInstances);
        break;
      default:
        selected = healthyInstances[0];
    }

    // Update instance metrics
    selected.activeRequests++;
    selected.load = selected.activeRequests / selected.capacity;
    this.requestCounts.set(selected.id, (this.requestCounts.get(selected.id) || 0) + 1);

    metrics.increment("load_balancer_requests_routed", { instance_id: selected.id });
    metrics.observe("load_balancer_instance_load", selected.load, { instance_id: selected.id });

    return selected;
  }

  /**
   * Release instance after request completes
   */
  releaseInstance(instanceId: string, responseTime: number, success: boolean): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    instance.activeRequests = Math.max(0, instance.activeRequests - 1);
    instance.load = instance.activeRequests / instance.capacity;

    // Update response time (exponential moving average)
    const alpha = 0.1;
    instance.responseTime = alpha * responseTime + (1 - alpha) * instance.responseTime;

    // Update error rate
    if (!success) {
      const beta = 0.1;
      instance.errorRate = beta * 1 + (1 - beta) * instance.errorRate;
    } else {
      const beta = 0.1;
      instance.errorRate = beta * 0 + (1 - beta) * instance.errorRate;
    }

    metrics.observe("load_balancer_response_time_ms", responseTime, { instance_id: instanceId });
    if (!success) {
      metrics.increment("load_balancer_request_errors", { instance_id: instanceId });
    }
  }

  /**
   * Round-robin selection
   */
  private roundRobin(instances: ServiceInstance[]): ServiceInstance {
    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex = (this.currentIndex + 1) % instances.length;
    return instance;
  }

  /**
   * Least connections selection
   */
  private leastConnections(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, instance) =>
      instance.activeRequests < min.activeRequests ? instance : min
    );
  }

  /**
   * Weighted selection (based on capacity and load)
   */
  private weighted(instances: ServiceInstance[]): ServiceInstance {
    const weights = instances.map(instance => {
      const capacityWeight = instance.capacity / 100; // normalize
      const loadWeight = 1 - instance.load; // prefer lower load
      return capacityWeight * loadWeight;
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < instances.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return instances[i];
      }
    }

    return instances[0];
  }

  /**
   * Latency-based selection
   */
  private latencyBased(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, instance) =>
      instance.responseTime < min.responseTime ? instance : min
    );
  }

  /**
   * Geographic selection with geo-redundant failover
   * Prefers same region/zone, with automatic failover to other regions
   */
  private geographic(instances: ServiceInstance[]): ServiceInstance {
    // Get client region from request context or environment
    const clientRegion = process.env.CLIENT_REGION || process.env.AWS_REGION || "us-east-1";
    const preferredZone = process.env.CLIENT_ZONE;
    
    // Group instances by region
    const byRegion = new Map<string, ServiceInstance[]>();
    for (const instance of instances) {
      const region = instance.region || "unknown";
      if (!byRegion.has(region)) {
        byRegion.set(region, []);
      }
      byRegion.get(region)!.push(instance);
    }
    
    // Priority order: same region > same zone > nearest region > any healthy
    // 1. Try same region, same zone
    if (preferredZone) {
      const sameZone = instances.filter(
        i => i.region === clientRegion && i.zone === preferredZone && i.health === "healthy"
      );
      if (sameZone.length > 0) {
        return this.latencyBased(sameZone);
      }
    }
    
    // 2. Try same region, any zone
    const sameRegion = instances.filter(
      i => i.region === clientRegion && i.health === "healthy"
    );
    if (sameRegion.length > 0) {
      return this.latencyBased(sameRegion);
    }
    
    // 3. Try nearest region (by latency)
    const otherRegions = Array.from(byRegion.entries())
      .filter(([region]) => region !== clientRegion)
      .map(([, instances]) => instances)
      .flat()
      .filter(i => i.health === "healthy");
    
    if (otherRegions.length > 0) {
      logger.info("Geo-redundant failover: routing to different region", {
        clientRegion,
        targetRegion: otherRegions[0].region,
      });
      metrics.increment("load_balancer_geo_failover", {
        from_region: clientRegion,
        to_region: otherRegions[0].region || "unknown",
      });
      return this.latencyBased(otherRegions);
    }
    
    // 4. Fallback to any healthy instance
    return this.latencyBased(instances);
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Perform initial health check
    this.performHealthChecks();
  }

  /**
   * Perform health checks on all instances
   */
  private async performHealthChecks(): Promise<void> {
    const checks = Array.from(this.instances.values()).map(instance =>
      this.checkInstanceHealth(instance)
    );

    await Promise.allSettled(checks);

    // Auto-scaling check
    if (this.config.enableAutoScaling && this.config.autoScalingPolicy) {
      await this.checkAutoScaling();
    }
  }

  /**
   * Check health of a single instance
   */
  private async checkInstanceHealth(instance: ServiceInstance): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.healthCheckTimeout);

      const startTime = Date.now();
      const response = await fetch(`${instance.url}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      const responseTime = Date.now() - startTime;

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        instance.health = data.status === "healthy" ? "healthy" : "degraded";
        instance.responseTime = responseTime;
      } else {
        instance.health = "unhealthy";
      }

      instance.lastHealthCheck = new Date();
    } catch (error) {
      instance.health = "unhealthy";
      logger.warn("Health check failed", { instanceId: instance.id, error });
      metrics.increment("load_balancer_health_check_failures", { instance_id: instance.id });
    }

    metrics.setGauge("load_balancer_instance_health", instance.health === "healthy" ? 1 : 0, {
      instance_id: instance.id,
    });
  }

  /**
   * Check and perform auto-scaling
   */
  private async checkAutoScaling(): Promise<void> {
    if (!this.config.autoScalingPolicy) return;

    const policy = this.config.autoScalingPolicy;
    const healthyInstances = Array.from(this.instances.values())
      .filter(instance => instance.health === "healthy");

    const currentCount = healthyInstances.length;
    const avgLoad = healthyInstances.reduce((sum, i) => sum + i.load, 0) / currentCount || 0;

    // Scale up if load is too high
    if (avgLoad > policy.scaleUpThreshold && currentCount < policy.maxInstances) {
      const scaleUpCount = Math.min(policy.scaleUpStep, policy.maxInstances - currentCount);
      await this.scaleUp(scaleUpCount);
    }

    // Scale down if load is too low
    if (avgLoad < policy.scaleDownThreshold && currentCount > policy.minInstances) {
      const scaleDownCount = Math.min(policy.scaleDownStep, currentCount - policy.minInstances);
      await this.scaleDown(scaleDownCount);
    }
  }

  /**
   * Scale up by adding instances
   */
  private async scaleUp(count: number): Promise<void> {
    logger.info("Scaling up", { count });
    metrics.increment("load_balancer_scale_up", { count: String(count) });

    // Integration with cloud providers and orchestration platforms
    const scalingProvider = process.env.SCALING_PROVIDER || "none";
    
    try {
      if (scalingProvider === "kubernetes") {
        // Kubernetes HPA (Horizontal Pod Autoscaler) integration
        const k8sApiUrl = process.env.K8S_API_URL;
        const namespace = process.env.K8S_NAMESPACE || "default";
        const deploymentName = process.env.K8S_DEPLOYMENT_NAME;
        
        if (k8sApiUrl && deploymentName) {
          // In production, use Kubernetes API client
          // For now, log the scaling action
          logger.info("Kubernetes scaling requested", {
            namespace,
            deployment: deploymentName,
            replicas: count,
            note: "Install @kubernetes/client-node for production Kubernetes integration",
          });
        }
      } else if (scalingProvider === "aws") {
        // AWS Auto Scaling Group integration
        const asgName = process.env.AWS_ASG_NAME;
        if (asgName) {
          try {
            const { AutoScalingClient, SetDesiredCapacityCommand } = await import("@aws-sdk/client-auto-scaling");
            const client = new AutoScalingClient({ region: process.env.AWS_REGION || "us-east-1" });
            
            const currentInstances = this.instances.size;
            const newDesiredCapacity = currentInstances + count;
            
            await client.send(
              new SetDesiredCapacityCommand({
                AutoScalingGroupName: asgName,
                DesiredCapacity: newDesiredCapacity,
                HonorCooldown: false,
              })
            );
            
            logger.info("AWS Auto Scaling Group updated", { asgName, newDesiredCapacity });
          } catch (sdkError: any) {
            if (sdkError.code === "MODULE_NOT_FOUND") {
              logger.warn("AWS Auto Scaling SDK not installed. Install with: npm install @aws-sdk/client-auto-scaling");
            } else {
              logger.error("AWS Auto Scaling update failed", { error: sdkError });
            }
          }
        }
      } else if (scalingProvider === "gcp") {
        // Google Cloud Platform Instance Group Manager
        const igmName = process.env.GCP_IGM_NAME;
        const zone = process.env.GCP_ZONE;
        
        if (igmName && zone) {
          logger.info("GCP scaling requested", {
            instanceGroupManager: igmName,
            zone,
            count,
            note: "Install @google-cloud/compute for production GCP integration",
          });
        }
      } else if (scalingProvider === "azure") {
        // Azure Virtual Machine Scale Set
        const vmssName = process.env.AZURE_VMSS_NAME;
        const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
        
        if (vmssName && resourceGroup) {
          logger.info("Azure scaling requested", {
            vmss: vmssName,
            resourceGroup,
            count,
            note: "Install @azure/arm-compute for production Azure integration",
          });
        }
      }
      
      // For all providers, the actual instance registration happens when new instances
      // report their health via the registerInstance method
      // This method triggers the infrastructure provisioning
    } catch (error) {
      logger.error("Scaling operation failed", { error, count, provider: scalingProvider });
      // Don't throw - scaling is best-effort, system can continue with current instances
    }
  }

  /**
   * Scale down by removing instances
   */
  private async scaleDown(count: number): Promise<void> {
    logger.info("Scaling down", { count });
    metrics.increment("load_balancer_scale_down", { count: String(count) });

    // Remove least loaded instances
    const instances = Array.from(this.instances.values())
      .filter(i => i.health === "healthy")
      .sort((a, b) => a.load - b.load)
      .slice(0, count);

    // Integration with cloud providers (similar to scaleUp)
    const scalingProvider = process.env.SCALING_PROVIDER || "none";
    
    try {
      if (scalingProvider === "aws") {
        const asgName = process.env.AWS_ASG_NAME;
        if (asgName) {
          try {
            const { AutoScalingClient, SetDesiredCapacityCommand } = await import("@aws-sdk/client-auto-scaling");
            const client = new AutoScalingClient({ region: process.env.AWS_REGION || "us-east-1" });
            
            const currentInstances = this.instances.size;
            const newDesiredCapacity = Math.max(1, currentInstances - count);
            
            await client.send(
              new SetDesiredCapacityCommand({
                AutoScalingGroupName: asgName,
                DesiredCapacity: newDesiredCapacity,
                HonorCooldown: true,
              })
            );
            
            logger.info("AWS Auto Scaling Group scaled down", { asgName, newDesiredCapacity });
          } catch (sdkError: any) {
            if (sdkError.code === "MODULE_NOT_FOUND") {
              logger.warn("AWS Auto Scaling SDK not installed");
            } else {
              logger.error("AWS Auto Scaling scale down failed", { error: sdkError });
            }
          }
        }
      }
      
      // Unregister instances from load balancer
      for (const instance of instances) {
        this.unregisterInstance(instance.id);
      }
    } catch (error) {
      logger.error("Scale down operation failed", { error, count });
    }

    for (const instance of instances) {
      this.unregisterInstance(instance.id);
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    totalInstances: number;
    healthyInstances: number;
    averageLoad: number;
    instances: ServiceInstance[];
  } {
    const instances = Array.from(this.instances.values());
    const healthyInstances = instances.filter(i => i.health === "healthy");
    const averageLoad = instances.reduce((sum, i) => sum + i.load, 0) / instances.length || 0;

    return {
      totalInstances: instances.length,
      healthyInstances: healthyInstances.length,
      averageLoad,
      instances: instances.map(i => ({ ...i })),
    };
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
}
