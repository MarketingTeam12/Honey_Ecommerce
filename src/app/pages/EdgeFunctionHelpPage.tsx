import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

export default function EdgeFunctionHelpPage() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runDiagnostics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Test basic connectivity
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
          setDiagnostics(data);
        } else {
          const errorText = await response.text();
          setError(`Edge Function returned ${response.status}: ${errorText}`);
        }
      } catch (err: any) {
        setError(`Cannot reach Edge Function: ${err.message}`);
      }

      setIsLoading(false);
    };

    runDiagnostics();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center mb-6">
            <span className="text-4xl mr-4">🔧</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Edge Function Troubleshooting
              </h1>
              <p className="text-gray-600 mt-1">
                Diagnose and fix "Invalid JWT" errors
              </p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="mb-8 p-4 rounded-lg bg-gray-100">
            <h2 className="font-semibold text-lg mb-2">Connection Status</h2>
            {isLoading && (
              <div className="flex items-center text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Testing connection...
              </div>
            )}
            {!isLoading && error && (
              <div className="text-red-600">
                <div className="font-semibold">❌ Connection Failed</div>
                <div className="text-sm mt-1">{error}</div>
              </div>
            )}
            {!isLoading && diagnostics && (
              <div className="text-green-600">
                <div className="font-semibold">✅ Edge Function is Accessible</div>
                <div className="text-sm mt-2 bg-white p-3 rounded">
                  <pre className="text-xs text-gray-700 overflow-auto">
                    {JSON.stringify(diagnostics, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Understanding the Issue */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Understanding "Invalid JWT" Errors
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                The error <code className="bg-gray-100 px-2 py-1 rounded">{"{"}"code":401,"message":"Invalid JWT"{"}"}</code> 
                occurs when Supabase Edge Functions reject incoming requests due to authentication issues.
              </p>
              <p>
                This error happens <strong>before</strong> the request reaches your application code, 
                at the Supabase infrastructure level.
              </p>
            </div>
          </div>

          {/* Common Causes */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Common Causes
            </h2>
            <div className="space-y-3">
              <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <h3 className="font-semibold text-yellow-900">1. Missing Environment Variables</h3>
                <p className="text-sm text-yellow-800 mt-1">
                  The Edge Function requires three environment variables:
                </p>
                <ul className="list-disc list-inside text-sm text-yellow-800 mt-2 ml-2">
                  <li><code>SUPABASE_URL</code></li>
                  <li><code>SUPABASE_SERVICE_ROLE_KEY</code></li>
                  <li><code>SUPABASE_ANON_KEY</code></li>
                </ul>
              </div>

              <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
                <h3 className="font-semibold text-blue-900">2. Edge Function Not Deployed</h3>
                <p className="text-sm text-blue-800 mt-1">
                  The Edge Function may not be deployed or may have failed during deployment.
                </p>
              </div>

              <div className="p-4 bg-purple-50 border-l-4 border-purple-400 rounded">
                <h3 className="font-semibold text-purple-900">3. Invalid JWT Token</h3>
                <p className="text-sm text-purple-800 mt-1">
                  The JWT token being sent doesn't match the Supabase project configuration.
                </p>
              </div>
            </div>
          </div>

          {/* Step-by-Step Fix */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Step-by-Step Fix
            </h2>
            <ol className="space-y-4">
              <li className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    1
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Check Supabase Dashboard
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Go to <a 
                        href={`https://supabase.com/dashboard/project/${projectId}/functions`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Edge Functions in Supabase Dashboard
                      </a>
                    </p>
                    <p className="text-sm text-gray-600">
                      Verify that the <code className="bg-gray-200 px-1 rounded">make-server-a67f0635</code> function is deployed and shows a green "Deployed" status.
                    </p>
                  </div>
                </div>
              </li>

              <li className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    2
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Verify Environment Variables
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      In the Edge Functions page, check that all required secrets are configured:
                    </p>
                    <ul className="text-sm text-gray-600 list-disc list-inside ml-2">
                      <li>SUPABASE_URL (auto-configured by Supabase)</li>
                      <li>SUPABASE_SERVICE_ROLE_KEY (auto-configured by Supabase)</li>
                      <li>SUPABASE_ANON_KEY (auto-configured by Supabase)</li>
                    </ul>
                    <p className="text-sm text-gray-500 mt-2 italic">
                      Note: These should be automatically configured by Supabase. If missing, contact Supabase support.
                    </p>
                  </div>
                </div>
              </li>

              <li className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    3
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Redeploy the Edge Function
                    </h3>
                    <p className="text-sm text-gray-600">
                      If the function is not deployed or has errors, redeploy it from the Supabase Dashboard.
                      Click on the function, then click "Deploy" or "Redeploy".
                    </p>
                  </div>
                </div>
              </li>

              <li className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    4
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Check Deployment Logs
                    </h3>
                    <p className="text-sm text-gray-600">
                      In the Edge Functions page, view the deployment logs to see if there are any errors during deployment.
                      Look for errors related to missing imports or syntax errors.
                    </p>
                  </div>
                </div>
              </li>

              <li className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    5
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Test Again
                    </h3>
                    <p className="text-sm text-gray-600">
                      After making changes, refresh this page and check if the connection status shows as successful.
                    </p>
                  </div>
                </div>
              </li>
            </ol>
          </div>

          {/* Additional Resources */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Additional Resources
            </h2>
            <div className="space-y-2">
              <a
                href="https://supabase.com/docs/guides/functions"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <div className="font-semibold text-blue-900">Supabase Edge Functions Documentation</div>
                <div className="text-sm text-blue-700">Learn more about Edge Functions</div>
              </a>
              <Link
                to="/debug/database"
                className="block p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <div className="font-semibold text-green-900">Database Diagnostics</div>
                <div className="text-sm text-green-700">Check database configuration and RLS settings</div>
              </Link>
            </div>
          </div>

          {/* Back Link */}
          <div className="flex justify-center">
            <Link
              to="/"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
