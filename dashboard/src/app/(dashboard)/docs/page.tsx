'use client';

import React, { useState } from 'react';
import { Book, Code, Terminal, Server, ArrowRight, Check, ShieldAlert, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<'curl' | 'node'>('node');
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeSnippets = {
    curl: `curl -X POST https://api.rategate.dev/v1/notify \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "EMAIL",
    "recipient": "user@example.com",
    "templateName": "welcome_email",
    "variables": { "name": "Alice" },
    "idempotencyKey": "req_12345"
  }'`,
    node: `const response = await fetch('https://api.rategate.dev/v1/notify', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    channel: 'EMAIL',
    recipient: 'user@example.com',
    templateName: 'welcome_email',
    variables: { name: 'Alice' },
    idempotencyKey: 'req_12345'
  })
});

if (response.status === 429) {
  const error = await response.json();
  console.error(\`Rate limited by scope: \${error.scope}\`);
} else if (response.status === 202) {
  const data = await response.json();
  console.log(\`Queued: \${data.id}\`);
}`
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12 pb-24">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
          <Book className="h-8 w-8 text-primary" />
          API Documentation
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Integrate the RateGate Multi-tenant Notification API into your application. 
          Send emails and SMS flawlessly without worrying about rate limits.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b pb-2">Base URL & Setup</h2>
        <p className="text-gray-600">
          To integrate RateGate into a separate consumer project (like a frontend app or another backend service), add the live RateGate API URL into your consumer project's environment variables.
        </p>
        <div className="bg-gray-100 p-4 rounded-md border text-sm font-mono flex flex-col gap-2">
           <div>
             <span className="text-gray-500 mr-2"># In your consumer project's .env file</span>
           </div>
           <div>RATEGATE_API_URL=<span className="text-primary font-bold">https://api.rategate.dev</span></div>
        </div>
        <p className="text-gray-600">
          All endpoints you use will be prefixed with this base URL.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b pb-2">Authentication</h2>
        <p className="text-gray-600">
          All API requests require your tenant API key to be passed in the <code className="bg-gray-100 px-1 rounded">Authorization</code> header as a Bearer token.
          You can generate and revoke API keys from your <a href="/api-keys" className="text-primary hover:underline font-medium">API Keys</a> dashboard.
        </p>
        <div className="bg-gray-100 p-4 rounded-md border text-sm font-mono flex items-center">
          <span className="text-gray-500 mr-4">Header</span>
          <span className="text-gray-900 leading-none">Authorization: Bearer <span className="text-primary">YOUR_API_KEY</span></span>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b pb-2">Send Notification Endpoint</h2>
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-md text-sm">POST</span>
          <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono font-medium text-base">/v1/notify</code>
        </div>
        
        <p className="text-gray-600">
          Submits a new notification to the queue. RateGate will automatically evaluate your active Rate Limit Rules before accepting the payload.
        </p>

        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b font-medium text-gray-700 text-sm">
            Request Body Parameters
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Field</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Required</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm text-gray-700">
              <tr>
                <td className="px-4 py-3 font-mono text-primary">channel</td>
                <td className="px-4 py-3">string</td>
                <td className="px-4 py-3 font-medium text-green-600">Yes</td>
                <td className="px-4 py-3 border-l text-gray-600">Either <code className="bg-gray-100 px-1 rounded font-mono text-xs text-black">EMAIL</code> or <code className="bg-gray-100 px-1 rounded font-mono text-xs text-black">SMS</code></td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-primary">recipient</td>
                <td className="px-4 py-3">string</td>
                <td className="px-4 py-3 font-medium text-green-600">Yes</td>
                <td className="px-4 py-3 border-l text-gray-600">Email address or Phone number with country code.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-primary">templateName</td>
                <td className="px-4 py-3">string</td>
                <td className="px-4 py-3">Conditional</td>
                <td className="px-4 py-3 border-l text-gray-600">The name of the template to use. Must provide either this or <code className="bg-gray-100 px-1 rounded">body</code>.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-primary">body</td>
                <td className="px-4 py-3">string</td>
                <td className="px-4 py-3">Conditional</td>
                <td className="px-4 py-3 border-l text-gray-600">Raw notification body. Must provide either this or <code className="bg-gray-100 px-1 rounded">templateName</code>.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-primary">subject</td>
                <td className="px-4 py-3">string</td>
                <td className="px-4 py-3">No</td>
                <td className="px-4 py-3 border-l text-gray-600">Required if channel is EMAIL and no template is used.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-primary">variables</td>
                <td className="px-4 py-3">object</td>
                <td className="px-4 py-3">No</td>
                <td className="px-4 py-3 border-l text-gray-600">Key-value pairs to inject into the template.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-primary">idempotencyKey</td>
                <td className="px-4 py-3">string</td>
                <td className="px-4 py-3">No</td>
                <td className="px-4 py-3 border-l text-gray-600">UUID or unique string. Prevents double-sends on network retries.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b pb-2 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          Handling Rate Limits
        </h2>
        <p className="text-gray-600">
          When a request exceeds your configured Rate Limit Rules, the API will return a <code className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-mono font-medium text-sm">429 Too Many Requests</code> HTTP status code. RateGate evaluates limits dynamically based on the tightest applicable rule (e.g., Template limits take precedence over Global API limits).
        </p>
        <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl ring-1 ring-gray-800 p-4 overflow-x-auto">
          <pre className="text-sm font-mono text-orange-300">
            <code>{`HTTP 429 Too Many Requests
{
  "error": "Rate limited: exceeded 5 requests per 60s for scope RECIPIENT",
  "scope": "RECIPIENT",
  "retryAfter": 42
}`}</code>
          </pre>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold border-b pb-2 flex items-center gap-2">
          <Webhook className="h-5 w-5 text-purple-500" />
          Webhooks (Real-Time Delivery)
        </h2>
        <p className="text-gray-600">
          Instead of polling for status updates, you can configure a Webhook URL in your <a href="/settings" className="text-primary hover:underline font-medium">Settings</a>. RateGate will send a signed <code className="bg-gray-100 px-1 rounded text-sm font-mono">POST</code> request to your backend whenever a notification transitions to <code className="bg-gray-100 px-1 rounded text-sm font-mono">SENT</code>, <code className="bg-gray-100 px-1 rounded text-sm font-mono">DELIVERED</code>, <code className="bg-gray-100 px-1 rounded text-sm font-mono">FAILED</code>, or <code className="bg-gray-100 px-1 rounded text-sm font-mono">RATE_LIMITED</code>.
        </p>
        <p className="text-gray-600 mt-2 text-sm">
          <strong>Security:</strong> All payloads include an <code className="bg-gray-100 px-1 rounded font-mono">X-RateGate-Signature</code> header (e.g., <code className="bg-gray-100 px-1 rounded font-mono">sha256=a1b2c3...</code>). Use your Webhook Secret to generate an HMAC-SHA256 signature of the raw request body and verify it matches the header using a constant-time equality check (like <code className="bg-gray-100 px-1 rounded font-mono">crypto.timingSafeEqual</code> in Node.js).
        </p>
        <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl ring-1 ring-gray-800 p-4 overflow-x-auto">
          <pre className="text-sm font-mono text-purple-200">
            <code>{`// Example Webhook Payload
{
  "event": "notification.delivered",
  "timestamp": "2026-07-21T18:25:23.000Z",
  "data": {
    "notificationId": "b3f6e1...a9d2",
    "channel": "EMAIL",
    "recipient": "user@example.com",
    "status": "DELIVERED"
  }
}`}</code>
          </pre>
        </div>
      </section>

      <section className="space-y-6 pt-6">
        <h2 className="text-2xl font-bold border-b pb-2 flex items-center gap-2">
          <Code className="h-5 w-5" />
          Integration Boilerplate
        </h2>
        
        <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl ring-1 ring-gray-800">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('node')}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'node' ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4" /> Node.js (Fetch)
                </div>
              </button>
              <button
                onClick={() => setActiveTab('curl')}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'curl' ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" /> cURL
                </div>
              </button>
            </div>
            
            <button 
              onClick={() => copyToClipboard(codeSnippets[activeTab])}
              className="text-gray-400 hover:text-white transition-colors p-1"
              title="Copy to clipboard"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <div className="text-xs border border-gray-600 px-2 py-1 rounded">Copy</div>}
            </button>
          </div>
          
          <div className="p-4 overflow-x-auto">
            <pre className="text-sm font-mono text-gray-300">
              <code>{codeSnippets[activeTab]}</code>
            </pre>
          </div>
        </div>
      </section>
      
      <div className="mt-16 pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
        <div>RateGate APIDoc v2.0.0</div>
        <a href="/api-keys" className="flex items-center gap-1 hover:text-primary transition-colors">
          Go to API Keys <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
