#!/bin/bash
# Kubernetes Deployment Verification Script
# Verifies all aspects of the Kubernetes deployment including ExternalSecrets, pods, and resources

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NAMESPACE="${NAMESPACE:-holdwall}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Holdwall POS - Kubernetes Deployment Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ kubectl detected${NC}"

# Check namespace
echo ""
echo -e "${YELLOW}Checking namespace...${NC}"
if kubectl get namespace "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✓ Namespace $NAMESPACE exists${NC}"
else
    echo -e "${RED}❌ Namespace $NAMESPACE not found${NC}"
    exit 1
fi

# Check ExternalSecrets Operator
echo ""
echo -e "${YELLOW}Checking ExternalSecrets Operator...${NC}"
if kubectl get crd externalsecrets.external-secrets.io &> /dev/null; then
    echo -e "${GREEN}✓ ExternalSecrets CRD exists${NC}"
    
    # Check SecretStore
    if kubectl get secretstore holdwall-secretstore -n "$NAMESPACE" &> /dev/null; then
        echo -e "${GREEN}✓ SecretStore exists${NC}"
    else
        echo -e "${RED}❌ SecretStore not found${NC}"
    fi
    
    # Check ExternalSecret
    if kubectl get externalsecret holdwall-secrets -n "$NAMESPACE" &> /dev/null; then
        echo -e "${GREEN}✓ ExternalSecret exists${NC}"
        
        # Check sync status
        SYNC_STATUS=$(kubectl get externalsecret holdwall-secrets -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
        if [ "$SYNC_STATUS" == "True" ]; then
            echo -e "${GREEN}✓ ExternalSecret synced successfully${NC}"
        else
            echo -e "${YELLOW}⚠️  ExternalSecret sync status: $SYNC_STATUS${NC}"
            echo -e "${YELLOW}   Run: kubectl describe externalsecret holdwall-secrets -n $NAMESPACE${NC}"
        fi
    else
        echo -e "${RED}❌ ExternalSecret not found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  ExternalSecrets Operator not installed${NC}"
    echo -e "${YELLOW}   Using manual secrets instead${NC}"
fi

# Check Kubernetes Secret
echo ""
echo -e "${YELLOW}Checking Kubernetes Secret...${NC}"
if kubectl get secret holdwall-secrets -n "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✓ Secret holdwall-secrets exists${NC}"
    
    # Check required keys
    REQUIRED_KEYS=("DATABASE_URL" "REDIS_URL" "KAFKA_BROKERS" "NEXTAUTH_SECRET" "NEXTAUTH_URL")
    MISSING_KEYS=()
    
    SECRET_KEYS=$(kubectl get secret holdwall-secrets -n "$NAMESPACE" -o jsonpath='{.data}' | jq -r 'keys[]' 2>/dev/null || echo "")
    
    for key in "${REQUIRED_KEYS[@]}"; do
        if echo "$SECRET_KEYS" | grep -q "^$key$"; then
            echo -e "${GREEN}  ✓ $key present${NC}"
        else
            echo -e "${RED}  ❌ $key missing${NC}"
            MISSING_KEYS+=("$key")
        fi
    done
    
    if [ ${#MISSING_KEYS[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Missing secret keys: ${MISSING_KEYS[*]}${NC}"
        echo -e "${YELLOW}   Ensure AWS Parameter Store has these values or update ExternalSecret${NC}"
    fi
else
    echo -e "${RED}❌ Secret holdwall-secrets not found${NC}"
    echo -e "${YELLOW}   Create it manually or ensure ExternalSecret is syncing${NC}"
fi

# Check ConfigMap
echo ""
echo -e "${YELLOW}Checking ConfigMap...${NC}"
if kubectl get configmap holdwall-config -n "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✓ ConfigMap holdwall-config exists${NC}"
else
    echo -e "${RED}❌ ConfigMap holdwall-config not found${NC}"
fi

# Check Deployments
echo ""
echo -e "${YELLOW}Checking Deployments...${NC}"
DEPLOYMENTS=("holdwall-app" "holdwall-worker" "holdwall-outbox-worker")
for deployment in "${DEPLOYMENTS[@]}"; do
    if kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
        READY=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        DESIRED=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        if [ "$READY" == "$DESIRED" ] && [ "$READY" != "0" ]; then
            echo -e "${GREEN}✓ $deployment: $READY/$DESIRED replicas ready${NC}"
        else
            echo -e "${YELLOW}⚠️  $deployment: $READY/$DESIRED replicas ready${NC}"
        fi
    else
        echo -e "${RED}❌ Deployment $deployment not found${NC}"
    fi
done

# Check Pods
echo ""
echo -e "${YELLOW}Checking Pods...${NC}"
PODS=$(kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null || echo "{}")
POD_COUNT=$(echo "$PODS" | jq '.items | length' 2>/dev/null || echo "0")
READY_COUNT=$(echo "$PODS" | jq '[.items[] | select(.status.conditions[]? | select(.type=="Ready" and .status=="True"))] | length' 2>/dev/null || echo "0")

echo -e "${BLUE}Pods: $READY_COUNT/$POD_COUNT ready${NC}"

# Check for problematic pod statuses
echo ""
echo -e "${YELLOW}Checking Pod Statuses...${NC}"
kubectl get pods -n "$NAMESPACE" -o json | jq -r '.items[] | "\(.metadata.name)\t\(.status.phase)\t\(.status.containerStatuses[0].ready // "false")\t\(.status.containerStatuses[0].state | to_entries[0].key // "unknown")\t\(.status.containerStatuses[0].state | to_entries[0].value.reason // "")"' 2>/dev/null | while IFS=$'\t' read -r name phase ready state reason; do
    if [ "$phase" == "Running" ] && [ "$ready" == "true" ]; then
        echo -e "${GREEN}✓ $name: Running and Ready${NC}"
    elif [ "$phase" == "Pending" ]; then
        echo -e "${YELLOW}⚠️  $name: Pending${NC}"
        # Get pending reason
        PENDING_REASON=$(kubectl get pod "$name" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="PodScheduled")].message}' 2>/dev/null || echo "")
        if [ ! -z "$PENDING_REASON" ]; then
            echo -e "${YELLOW}   Reason: $PENDING_REASON${NC}"
        fi
    elif [ "$state" == "waiting" ]; then
        echo -e "${YELLOW}⚠️  $name: Waiting (Reason: $reason)${NC}"
        if [ "$reason" == "ImagePullBackOff" ] || [ "$reason" == "ErrImagePull" ]; then
            echo -e "${YELLOW}   Check image tag and ECR permissions${NC}"
        elif [ "$reason" == "CreateContainerConfigError" ]; then
            echo -e "${YELLOW}   Check secrets and configmaps${NC}"
        fi
    elif [ "$state" == "terminated" ]; then
        EXIT_CODE=$(kubectl get pod "$name" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}' 2>/dev/null || echo "")
        echo -e "${RED}❌ $name: Terminated (Exit: $EXIT_CODE)${NC}"
        echo -e "${YELLOW}   Check logs: kubectl logs $name -n $NAMESPACE${NC}"
    else
        echo -e "${YELLOW}⚠️  $name: $phase ($state: $reason)${NC}"
    fi
done

# Check Init Containers
echo ""
echo -e "${YELLOW}Checking Init Containers...${NC}"
kubectl get pods -n "$NAMESPACE" -o json | jq -r '.items[] | select(.spec.initContainers != null) | "\(.metadata.name)\t\(.status.initContainerStatuses[0].state | to_entries[0].key // "unknown")\t\(.status.initContainerStatuses[0].state | to_entries[0].value.reason // "")\t\(.status.initContainerStatuses[0].state | to_entries[0].value.exitCode // "")"' 2>/dev/null | while IFS=$'\t' read -r name state reason exit_code; do
    if [ "$state" == "running" ]; then
        echo -e "${GREEN}✓ $name init container: Running${NC}"
    elif [ "$state" == "terminated" ] && [ "$exit_code" == "0" ]; then
        echo -e "${GREEN}✓ $name init container: Completed${NC}"
    elif [ "$state" == "terminated" ] && [ "$exit_code" != "0" ]; then
        echo -e "${RED}❌ $name init container: Failed (Exit: $exit_code, Reason: $reason)${NC}"
        echo -e "${YELLOW}   Check logs: kubectl logs $name -n $NAMESPACE -c db-migrate${NC}"
    elif [ "$state" == "waiting" ]; then
        echo -e "${YELLOW}⚠️  $name init container: Waiting (Reason: $reason)${NC}"
    else
        echo -e "${YELLOW}⚠️  $name init container: $state ($reason)${NC}"
    fi
done

# Check CronJobs
echo ""
echo -e "${YELLOW}Checking CronJobs...${NC}"
CRONJOBS=("holdwall-backup" "holdwall-reindex" "holdwall-pos-cycle")
for cronjob in "${CRONJOBS[@]}"; do
    if kubectl get cronjob "$cronjob" -n "$NAMESPACE" &> /dev/null; then
        LAST_SCHEDULE=$(kubectl get cronjob "$cronjob" -n "$NAMESPACE" -o jsonpath='{.status.lastScheduleTime}' 2>/dev/null || echo "Never")
        echo -e "${GREEN}✓ $cronjob (Last: $LAST_SCHEDULE)${NC}"
    else
        echo -e "${RED}❌ CronJob $cronjob not found${NC}"
    fi
done

# Check Services
echo ""
echo -e "${YELLOW}Checking Services...${NC}"
if kubectl get service holdwall-app -n "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✓ Service holdwall-app exists${NC}"
else
    echo -e "${RED}❌ Service holdwall-app not found${NC}"
fi

# Check Ingress
echo ""
echo -e "${YELLOW}Checking Ingress...${NC}"
if kubectl get ingress holdwall-ingress -n "$NAMESPACE" &> /dev/null; then
    INGRESS_HOST=$(kubectl get ingress holdwall-ingress -n "$NAMESPACE" -o jsonpath='{.spec.rules[0].host}' 2>/dev/null || echo "")
    echo -e "${GREEN}✓ Ingress exists${NC}"
    if [ ! -z "$INGRESS_HOST" ]; then
        echo -e "${GREEN}  Host: $INGRESS_HOST${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Ingress not found (may be using LoadBalancer)${NC}"
fi

# Check HPA
echo ""
echo -e "${YELLOW}Checking HPA...${NC}"
if kubectl get hpa holdwall-app-hpa -n "$NAMESPACE" &> /dev/null; then
    CURRENT_REPLICAS=$(kubectl get hpa holdwall-app-hpa -n "$NAMESPACE" -o jsonpath='{.status.currentReplicas}' 2>/dev/null || echo "0")
    DESIRED_REPLICAS=$(kubectl get hpa holdwall-app-hpa -n "$NAMESPACE" -o jsonpath='{.spec.minReplicas}' 2>/dev/null || echo "0")
    echo -e "${GREEN}✓ HPA exists (Current: $CURRENT_REPLICAS, Min: $DESIRED_REPLICAS)${NC}"
else
    echo -e "${YELLOW}⚠️  HPA not found${NC}"
fi

# Check Node Resources
echo ""
echo -e "${YELLOW}Checking Node Resources...${NC}"
NODES=$(kubectl get nodes -o json 2>/dev/null || echo "{}")
NODE_COUNT=$(echo "$NODES" | jq '.items | length' 2>/dev/null || echo "0")
echo -e "${BLUE}Nodes: $NODE_COUNT${NC}"

# Check for resource constraints
PENDING_PODS=$(kubectl get pods -n "$NAMESPACE" -o json | jq '[.items[] | select(.status.phase=="Pending")] | length' 2>/dev/null || echo "0")
if [ "$PENDING_PODS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $PENDING_PODS pods are Pending${NC}"
    echo -e "${YELLOW}   Check node resources and resource requests${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"

if [ ${#MISSING_KEYS[@]} -eq 0 ] && [ "$READY_COUNT" == "$POD_COUNT" ] && [ "$POD_COUNT" != "0" ]; then
    echo -e "${GREEN}✅ Deployment looks healthy${NC}"
    EXIT_CODE=0
else
    echo -e "${YELLOW}⚠️  Deployment has issues${NC}"
    if [ ${#MISSING_KEYS[@]} -gt 0 ]; then
        echo -e "${YELLOW}   - Missing secret keys: ${MISSING_KEYS[*]}${NC}"
    fi
    if [ "$READY_COUNT" != "$POD_COUNT" ]; then
        echo -e "${YELLOW}   - Pods not ready: $READY_COUNT/$POD_COUNT${NC}"
    fi
    EXIT_CODE=1
fi

echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  kubectl get pods -n $NAMESPACE"
echo -e "  kubectl describe externalsecret holdwall-secrets -n $NAMESPACE"
echo -e "  kubectl logs <pod-name> -n $NAMESPACE -c db-migrate"
echo -e "  kubectl get events -n $NAMESPACE --sort-by=.lastTimestamp"

exit $EXIT_CODE
