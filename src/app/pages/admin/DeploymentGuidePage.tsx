import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  Copy,
  Database,
  ExternalLink,
  AlertTriangle,
  Zap,
  Loader2,
  ArrowRight,
  Server,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/app/components/admin/AdminLayout';
import { projectId } from '@/utils/supabase/info';
import { copyToClipboard } from '@/app/utils/clipboard';
import { buildHeaders } from '@/app/utils/buildHeaders';

export function DeploymentGuidePage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/setup/status`,
          {
            headers: buildHeaders(),
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);
        setBackendStatus(response.ok ? 'online' : 'offline');
      } catch {
        setBackendStatus('offline');
      }
    };

    checkBackendStatus();
  }, []);

  const copyToClipboardHandler = async (text: string, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(label);
      toast.success(`Copied ${label}!`);
      setTimeout(() => setCopied(null), 2000);
    } else {
      toast.error('Failed to copy. Please try again.');
    }
  };

  const commands = {
    install: 'npm install -g supabase',
    login: 'supabase login',
    link: `supabase link --project-ref ${projectId}`,
    deploy: 'supabase functions deploy make-server-a67f0635',
    secrets: `supabase secrets set SUPABASE_URL=https://${projectId}.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
supabase secrets set SUPABASE_ANON_KEY=your_anon_key_here
supabase secrets set SUPABASE_DB_URL=your_database_url_here`,
    verify: 'supabase functions list',
  };

  const isOnline = backendStatus === 'online';

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {backendStatus === 'checking' && (
            <div className="mb-8 bg-white border-2 border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 text-gray-700">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="font-medium">Checking backend status...</span>
              </div>
            </div>
          )}

          {isOnline && (
            <div className="mb-8 bg-green-50 border-2 border-green-200 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-green-900 mb-2">Backend Is Live</h2>
                  <p className="text-green-800 mb-4">
                    Your Supabase Edge Function is responding correctly. You do not need the deployment steps right now.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to="/admin"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Go to Dashboard
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a
                      href={`https://supabase.com/dashboard/project/${projectId}/functions`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white text-green-700 border border-green-300 font-semibold rounded-lg hover:bg-green-100 transition-colors"
                    >
                      Open Supabase Functions
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Database className={`w-10 h-10 ${isOnline ? 'text-green-600' : 'text-red-600'}`} />
              <h1 className="text-3xl font-bold text-gray-900">Deploy Your Backend</h1>
            </div>
            <p className="text-gray-600">
              {isOnline
                ? 'This page is a deployment reference. Your backend is currently reachable.'
                : 'Your Supabase Edge Function is not deployed yet or is not reachable. Follow these steps to deploy or restore it.'}
            </p>
          </div>

          <div
            className={`rounded-lg p-6 mb-8 border-2 ${
              isOnline ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-300'
            }`}
          >
            <div className="flex items-start gap-4">
              {isOnline ? (
                <Server className="w-8 h-8 text-amber-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
              )}
              <div>
                <h2 className={`text-xl font-bold mb-2 ${isOnline ? 'text-amber-900' : 'text-red-900'}`}>
                  {isOnline ? 'You Are Viewing the Deployment Guide' : 'Backend Not Deployed (502 Error)'}
                </h2>
                <p className={`${isOnline ? 'text-amber-800' : 'text-red-800'} mb-4`}>
                  {isOnline
                    ? 'The backend health check passed. If you expected the normal admin panel, use the dashboard button above or open `/admin`.'
                    : 'Your application is getting a 502 Bad Gateway error because the Supabase Edge Function has not been deployed yet.'}
                </p>
                {!isOnline && (
                  <div className="bg-white border border-red-200 rounded p-4">
                    <p className="font-semibold text-red-900 mb-2">Without the backend:</p>
                    <ul className="list-disc ml-5 space-y-1 text-sm text-red-800">
                      <li>Orders will not save to the database</li>
                      <li>The admin panel will not display orders correctly</li>
                      <li>Payment processing will not work</li>
                      <li>File uploads will not be stored</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  1
                </div>
                <h3 className="text-xl font-bold text-gray-900">Install Supabase CLI</h3>
              </div>

              <p className="text-gray-700 mb-4">First, install the Supabase command-line tool on your computer:</p>

              <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500"># Install Supabase CLI</span>
                  <button
                    onClick={() => copyToClipboardHandler(commands.install, 'command')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copied === 'command' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <code>{commands.install}</code>
              </div>

              <div className="text-sm text-gray-600">
                <strong>Note:</strong> On Mac, you can also use: <code className="bg-gray-100 px-2 py-1 rounded">brew install supabase/tap/supabase</code>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  2
                </div>
                <h3 className="text-xl font-bold text-gray-900">Login to Supabase</h3>
              </div>

              <p className="text-gray-700 mb-4">Authenticate with your Supabase account:</p>

              <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500"># Login to Supabase</span>
                  <button
                    onClick={() => copyToClipboardHandler(commands.login, 'login command')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copied === 'login command' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <code>{commands.login}</code>
              </div>

              <div className="text-sm text-gray-600">This will open your browser to authenticate. Follow the prompts to log in.</div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  3
                </div>
                <h3 className="text-xl font-bold text-gray-900">Link Your Project</h3>
              </div>

              <p className="text-gray-700 mb-4">Connect to your Supabase project:</p>

              <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500"># Link to your project</span>
                  <button
                    onClick={() => copyToClipboardHandler(commands.link, 'link command')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copied === 'link command' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <code>{commands.link}</code>
              </div>

              <div className="text-sm text-gray-600">When prompted, enter your database password from the Supabase dashboard.</div>
            </div>

            <div className="bg-white border-2 border-green-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  4
                </div>
                <h3 className="text-xl font-bold text-gray-900">Deploy the Function</h3>
              </div>

              <p className="text-gray-700 mb-4">Deploy your Edge Function to Supabase:</p>

              <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500"># Deploy the backend</span>
                  <button
                    onClick={() => copyToClipboardHandler(commands.deploy, 'deploy command')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copied === 'deploy command' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <code>{commands.deploy}</code>
              </div>

              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                <strong>This will:</strong> Upload your code, deploy it to Supabase servers, and make it accessible via HTTPS.
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  5
                </div>
                <h3 className="text-xl font-bold text-gray-900">Set Environment Variables</h3>
              </div>

              <p className="text-gray-700 mb-4">Configure your backend with Supabase credentials:</p>

              <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs mb-3 overflow-x-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500"># Set environment secrets</span>
                  <button
                    onClick={() => copyToClipboardHandler(commands.secrets, 'secrets commands')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copied === 'secrets commands' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="whitespace-pre">{commands.secrets}</pre>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                <strong>Important:</strong> Get your keys from Supabase Dashboard - Project Settings - API
                <a
                  href={`https://supabase.com/dashboard/project/${projectId}/settings/api`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  Open API Settings <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  6
                </div>
                <h3 className="text-xl font-bold text-gray-900">Verify Deployment</h3>
              </div>

              <p className="text-gray-700 mb-4">Check that your function is deployed and active:</p>

              <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500"># List all functions</span>
                  <button
                    onClick={() => copyToClipboardHandler(commands.verify, 'verify command')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copied === 'verify command' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <code>{commands.verify}</code>
              </div>

              <div className="text-sm text-gray-600">
                You should see <code className="bg-gray-100 px-2 py-1 rounded">make-server-a67f0635</code> with status "ACTIVE"
              </div>
            </div>
          </div>

          <div className="mt-8 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg p-6">
            <div className="flex items-start gap-4">
              <Zap className="w-8 h-8 flex-shrink-0" />
              <div>
                <h3 className="text-2xl font-bold mb-2">After Deployment</h3>
                <p className="mb-4">Once your backend is deployed, complete the setup:</p>
                <ol className="list-decimal ml-5 space-y-2 mb-4">
                  <li>Go to <strong>/admin/diagnostics</strong></li>
                  <li>Click <strong>Auto-Fix Database</strong></li>
                  <li>Wait a few seconds for setup to complete</li>
                  <li>All systems should be operational</li>
                </ol>
                <Link
                  to="/admin/diagnostics"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-green-700 font-bold rounded-lg hover:bg-green-50 transition-colors"
                >
                  Go to Diagnostics Page
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">Helpful Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://supabase.com/docs/guides/functions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                  Edge Functions Documentation <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a href="https://supabase.com/docs/reference/cli/introduction" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                  Supabase CLI Documentation <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a href={`https://supabase.com/dashboard/project/${projectId}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                  Your Supabase Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default DeploymentGuidePage;

