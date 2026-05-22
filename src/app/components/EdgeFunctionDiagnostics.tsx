import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  details?: any;
}

/**
 * EdgeFunctionDiagnostics - Tests Edge Function connectivity and displays results
 * Shows a banner if there are critical issues
 */
export function EdgeFunctionDiagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const runDiagnostics = async () => {
      const tests: DiagnosticResult[] = [];

      // Test 1: Check if publicAnonKey is valid
      console.log('ðŸ” [Diagnostics] Test 1: Checking publicAnonKey validity...');
      if (!publicAnonKey || publicAnonKey === 'undefined' || publicAnonKey.length < 20) {
        tests.push({
          test: 'Public Anon Key',
          status: 'error',
          message: 'publicAnonKey is invalid or missing',
          details: { value: publicAnonKey }
        });
      } else {
        tests.push({
          test: 'Public Anon Key',
          status: 'success',
          message: 'publicAnonKey is present and looks valid',
          details: { length: publicAnonKey.length }
        });
      }

      // Test 2: Try to reach the ultra-simple root endpoint
      console.log('ðŸ” [Diagnostics] Test 2: Testing basic Edge Function connectivity...');
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/`,
          {
            method: 'GET',
            headers: {
              'apikey': publicAnonKey,
              'Authorization': `Bearer ${publicAnonKey}`
            },
            signal: AbortSignal.timeout(5000)
          }
        );

        if (response.ok) {
          const data = await response.json();
          tests.push({
            test: 'Edge Function Connectivity',
            status: 'success',
            message: 'Edge Function is accessible',
            details: data
          });
        } else {
          const errorText = await response.text();
          tests.push({
            test: 'Edge Function Connectivity',
            status: 'error',
            message: `Edge Function returned ${response.status}: ${response.statusText}`,
            details: { status: response.status, error: errorText }
          });
        }
      } catch (error: any) {
        tests.push({
          test: 'Edge Function Connectivity',
          status: 'error',
          message: 'Cannot reach Edge Function',
          details: { error: error.message }
        });
      }

      // Test 3: Try to fetch /health endpoint
      console.log('ðŸ” [Diagnostics] Test 3: Testing /health endpoint...');
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/health`,
          {
            method: 'GET',
            headers: {
              'apikey': publicAnonKey,
              'Authorization': `Bearer ${publicAnonKey}`
            },
            signal: AbortSignal.timeout(5000)
          }
        );

        if (response.ok) {
          const data = await response.json();
          tests.push({
            test: 'Health Endpoint',
            status: 'success',
            message: 'Health check passed',
            details: data
          });
        } else {
          const errorText = await response.text();
          tests.push({
            test: 'Health Endpoint',
            status: 'error',
            message: `Health check failed: ${response.status}`,
            details: { error: errorText }
          });
        }
      } catch (error: any) {
        tests.push({
          test: 'Health Endpoint',
          status: 'error',
          message: 'Health check failed',
          details: { error: error.message }
        });
      }

      // Test 4: Try to fetch /diagnostics endpoint
      console.log('ðŸ” [Diagnostics] Test 4: Testing /diagnostics endpoint...');
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/diagnostics`,
          {
            method: 'GET',
            headers: {
              'apikey': publicAnonKey,
              'Authorization': `Bearer ${publicAnonKey}`
            },
            signal: AbortSignal.timeout(5000)
          }
        );

        if (response.ok) {
          const data = await response.json();
          tests.push({
            test: 'Server Diagnostics',
            status: 'success',
            message: 'Server diagnostics retrieved',
            details: data
          });
        } else {
          const errorText = await response.text();
          tests.push({
            test: 'Server Diagnostics',
            status: 'error',
            message: `Diagnostics failed: ${response.status}`,
            details: { error: errorText }
          });
        }
      } catch (error: any) {
        tests.push({
          test: 'Server Diagnostics',
          status: 'error',
          message: 'Server diagnostics failed',
          details: { error: error.message }
        });
      }

      setResults(tests);
      setIsRunning(false);

      // Log all results
      console.log('ðŸ” [Diagnostics] All tests complete:', tests);
    };

    runDiagnostics();
  }, []);

  // Calculate overall status
  const hasErrors = results.some(r => r.status === 'error');
  const hasCriticalError = results.find(r => 
    r.test === 'Edge Function Connectivity' && r.status === 'error'
  );

  // Don't show anything if everything is working
  if (!isRunning && !hasErrors) {
    return null;
  }

  // Don't show anything if still running
  if (isRunning) {
    return null;
  }

  // Show warning banner if there are errors
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50 border-b-2 border-yellow-400">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center">
              <span className="text-2xl mr-2">âš </span>
              <div>
                <h3 className="font-semibold text-yellow-900">
                  {hasCriticalError ? 'Edge Function Not Accessible' : 'Configuration Issues Detected'}
                </h3>
                <p className="text-sm text-yellow-800 mt-1">
                  {hasCriticalError 
                    ? 'The Supabase Edge Function is not responding. This may cause authentication and data loading issues.'
                    : 'Some backend services are experiencing issues. The app may have limited functionality.'}
                </p>
              </div>
            </div>
            
            {showDetails && (
              <div className="mt-4 space-y-2">
                {results.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg text-sm ${
                      result.status === 'success' ? 'bg-green-100' : 
                      result.status === 'error' ? 'bg-red-100' : 'bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">
                          {result.status === 'success' ? 'âœ…' : 'âŒ'} {result.test}
                        </div>
                        <div className={result.status === 'success' ? 'text-green-700' : 'text-red-700'}>
                          {result.message}
                        </div>
                        {result.details && (
                          <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-40">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Troubleshooting Steps:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                    <li>Check that the Supabase Edge Function is deployed and running</li>
                    <li>Verify that environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY) are configured</li>
                    <li>Check the Supabase dashboard for any deployment errors</li>
                    <li>Try redeploying the Edge Function from the Supabase dashboard</li>
                    <li>Check browser console for detailed error messages</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Link
              to="/debug/edge-function"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
            >
              Fix Guide
            </Link>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm font-medium"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EdgeFunctionDiagnostics;

