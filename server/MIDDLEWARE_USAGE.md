# Advanced Middleware System Usage Guide

## Overview

The LingEcho server now includes an advanced middleware system with the following features:

- **User-level Rate Limiting**: Granular rate limiting per user, IP, and endpoint
- **Request Timeout Handling**: Configurable timeouts with fallback responses
- **Circuit Breaker Pattern**: Automatic service degradation and recovery
- **Dynamic Configuration**: Runtime configuration updates via API
- **Comprehensive Statistics**: Real-time monitoring and metrics

## Configuration

### Environment Variables

The middleware system can be configured via environment variables:

```bash
# Rate Limiting
RATE_LIMIT_GLOBAL_RPS=1000          # Global requests per second
RATE_LIMIT_GLOBAL_BURST=2000        # Global burst capacity
RATE_LIMIT_USER_RPS=100             # User requests per second
RATE_LIMIT_USER_BURST=200           # User burst capacity
RATE_LIMIT_IP_RPS=50                # IP requests per second
RATE_LIMIT_IP_BURST=100             # IP burst capacity

# Timeout Configuration
DEFAULT_TIMEOUT=30s                 # Default request timeout

# Circuit Breaker
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5 # Failures before opening
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=3 # Successes before closing
CIRCUIT_BREAKER_TIMEOUT=30s         # Circuit breaker timeout
CIRCUIT_BREAKER_OPEN_TIMEOUT=60s    # Time before retry
CIRCUIT_BREAKER_MAX_CONCURRENT=100  # Max concurrent requests

# Enable/Disable Features
ENABLE_RATE_LIMIT=true              # Enable rate limiting
ENABLE_TIMEOUT=true                 # Enable timeout handling
ENABLE_CIRCUIT_BREAKER=true         # Enable circuit breaker
ENABLE_OPERATION_LOG=true           # Enable operation logging
```

### Default Configuration

The system automatically configures different defaults based on the environment:

**Production Environment:**
- More restrictive rate limits
- Shorter timeouts
- Lower failure thresholds

**Development Environment:**
- Relaxed rate limits
- Longer timeouts
- Circuit breaker disabled by default

## API Endpoints

### Get Middleware Statistics

```http
GET /api/middleware/stats
```

Returns comprehensive statistics about middleware performance:

```json
{
  "code": 200,
  "msg": "Middleware statistics retrieved successfully",
  "data": {
    "stats": {
      "rate_limiter": {
        "global": {
          "tokens": 1500,
          "requests": 250
        },
        "user_buckets": 45,
        "ip_buckets": 23
      },
      "circuit_breakers": {
        "/api/auth/login": {
          "state": 0,
          "failure_count": 0,
          "success_count": 15,
          "concurrent_count": 0
        }
      }
    }
  }
}
```

### Update Rate Limit Configuration

```http
PUT /api/middleware/rate-limit/config
Content-Type: application/json

{
  "GlobalRPS": 2000,
  "GlobalBurst": 4000,
  "UserRPS": 200,
  "UserBurst": 400,
  "IPRPS": 100,
  "IPBurst": 200
}
```

### Update Timeout Configuration

```http
PUT /api/middleware/timeout/config
Content-Type: application/json

{
  "DefaultTimeout": "45s",
  "FallbackResponse": {
    "error": "service_unavailable",
    "message": "Service temporarily unavailable"
  }
}
```

### Update Circuit Breaker Configuration

```http
PUT /api/middleware/circuit-breaker/config
Content-Type: application/json

{
  "FailureThreshold": 3,
  "SuccessThreshold": 2,
  "Timeout": "30s",
  "OpenTimeout": "60s",
  "MaxConcurrentRequests": 200
}
```

## Rate Limiting Behavior

### Multi-Level Rate Limiting

The system applies rate limiting at multiple levels:

1. **Global Level**: Overall system capacity
2. **IP Level**: Per-IP address limits
3. **User Level**: Per-authenticated user limits
4. **Endpoint Level**: Specific API endpoint limits

### Endpoint-Specific Limits

Certain endpoints have special rate limiting rules:

- **Login endpoints** (`/api/auth/login/*`): 5 attempts per minute
- **Registration** (`/api/auth/register`): 3 attempts per hour
- **Email verification** (`/api/auth/send/email`): 3 attempts per minute
- **File upload** (`/api/upload`): 10 uploads per minute

### Rate Limit Headers

When rate limiting is active, the following headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Timeout Handling

### Endpoint-Specific Timeouts

Different endpoints have different timeout configurations:

- **Authentication**: 10 seconds
- **File uploads**: 5 minutes
- **AI/Chat**: 60 seconds
- **Workflow execution**: 10 minutes
- **Voice processing**: 30 seconds

### Timeout Response

When a request times out, the system returns:

```json
{
  "error": "request_timeout",
  "message": "请求超时，超过 30s",
  "timeout": "30s"
}
```

## Circuit Breaker Pattern

### States

The circuit breaker has three states:

1. **Closed**: Normal operation, requests pass through
2. **Open**: Failing fast, requests are rejected immediately
3. **Half-Open**: Testing if service has recovered

### Failure Criteria

The circuit breaker considers these as failures:
- HTTP 5xx status codes
- Request timeouts
- Panics in request handlers

### Success Criteria

The circuit breaker considers these as successes:
- HTTP 2xx and 3xx status codes
- HTTP 4xx status codes (client errors, not service failures)

## Monitoring and Observability

### Real-time Statistics

The middleware system provides real-time statistics including:

- Token bucket states for rate limiting
- Circuit breaker states and counters
- Request success/failure rates
- Average response times

### Integration with Metrics System

The middleware integrates with the existing metrics system to provide:

- Prometheus-compatible metrics
- Request tracing (when enabled)
- Performance analytics

## Best Practices

### Rate Limiting

1. **Monitor token bucket exhaustion** to identify capacity issues
2. **Adjust limits based on usage patterns** using the dynamic configuration API
3. **Use endpoint-specific limits** for critical operations like authentication

### Timeout Configuration

1. **Set realistic timeouts** based on expected operation duration
2. **Provide meaningful fallback responses** for timeout scenarios
3. **Monitor timeout rates** to identify performance bottlenecks

### Circuit Breaker

1. **Tune failure thresholds** based on service reliability requirements
2. **Monitor circuit breaker state changes** for early problem detection
3. **Implement proper fallback mechanisms** in client applications

## Troubleshooting

### Common Issues

1. **Rate limit exceeded**: Check current limits and usage patterns
2. **Frequent timeouts**: Review endpoint performance and timeout configuration
3. **Circuit breaker constantly open**: Investigate underlying service issues

### Debug Information

Use the statistics endpoint to get detailed information about middleware state and performance.