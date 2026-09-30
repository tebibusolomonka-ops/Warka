export function securityPosture(
  env: NodeJS.ProcessEnv,
  counts: { throttled: number; quarantined: number },
) {
  return {
    csrfProtection: 'enabled',
    trustedOriginPolicy: env.WARKA_ALLOWED_ORIGINS
      ? 'configured'
      : 'same-origin',
    securityHeaders: 'enabled',
    secureCookieProductionPolicy: 'required',
    malwareScanner: env.FILE_SCANNER_BACKEND ? 'configured' : 'unavailable',
    dependencyAudit:
      env.WARKA_DEPENDENCY_AUDIT_STATUS === 'passed' ? 'passed' : 'unknown',
    sbomAvailable: env.WARKA_SBOM_AVAILABLE === 'true',
    recentAccountThrottlingCount: counts.throttled,
    recentQuarantinedFileCount: counts.quarantined,
    authorizationRegressionSuite: 'authorization-matrix-v1',
  }
}
