/*
 * OWASP WSTG checklist seed data.
 * Source: local checklist.md (latest WSTG layout).
 * Item format: [number, title, severity, tags[], description, optional page slug]
 * The page slug defaults to the title with spaces -> underscores (parenthesised text dropped).
 * Edit this file to update the default checklist for NEW projects.
 * Loaded as a plain <script> so it works from file:// without a server.
 */
window.WSTG_DATA = (function () {
  var BASE = 'https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/';

  var categories = [
    {
      id: 'WSTG-INFO', name: 'Information Gathering', emoji: '🔎', path: '01-Information_Gathering/',
      items: [
        ['01', 'Conduct Search Engine Reconnaissance for Information Leakage', 'info', ['recon'], 'Use search engines, caches and web archives to find sensitive design, configuration or personal information exposed directly or indirectly.'],
        ['02', 'Fingerprint Web Server', 'info', ['recon'], 'Identify the web server type and version through banners, header ordering and response behaviour to look up known vulnerabilities.'],
        ['03', 'Review Webserver Metafiles for Information Leakage', 'low', ['recon'], 'Analyse robots.txt, sitemap.xml, security.txt, humans.txt and META tags for leaked paths, functionality or contacts.'],
        ['04', 'Attack Surface Identification', 'info', ['recon'], 'Enumerate applications, virtual hosts, non-standard ports and related services hosted on the target infrastructure.'],
        ['05', 'Review Web Page Content for Information Leakage', 'low', ['recon'], 'Inspect HTML comments, JavaScript, source maps and metadata for credentials, API keys, internal paths or debug information.'],
        ['06', 'Identify Application Entry Points', 'info', ['recon'], 'Map every request, parameter, header and cookie that accepts user input, including hidden fields and API endpoints.'],
        ['07', 'Map Execution Paths Through Application', 'info', ['recon'], 'Map workflows and code paths to understand the application and ensure test coverage of all functionality.'],
        ['08', 'Fingerprint Web Application Framework', 'info', ['recon'], 'Identify frameworks and libraries via headers, cookies, file paths and markup to target known weaknesses.'],
        ['09', 'Fingerprint Web Application', 'info', ['recon'], 'Identify the specific application or CMS and its version, then check for publicly known vulnerabilities.'],
        ['10', 'Map Application Architecture', 'info', ['recon'], 'Identify components such as reverse proxies, load balancers, WAFs, CDNs, databases and third-party services.']
      ]
    },
    {
      id: 'WSTG-CONF', name: 'Configuration and Deployment Management', emoji: '⚙️', path: '02-Configuration_and_Deployment_Management/',
      items: [
        ['01', 'Network Infrastructure Configuration', 'medium', ['infra'], 'Review network and infrastructure components (servers, admin tools, exposed ports) for known vulnerabilities and insecure configuration.'],
        ['02', 'Application Platform Configuration', 'medium', ['config'], 'Check for default or sample files, debug modes, verbose logging and insecure server or framework settings.'],
        ['03', 'File Extensions Handling for Sensitive Information', 'medium', ['config'], 'Verify how the server handles file extensions (.inc, .bak, .config, …) and that sensitive files are not served or executed improperly.'],
        ['04', 'Review Old Backup and Unreferenced Files for Sensitive Information', 'medium', ['config'], 'Search for backup, old, temporary and unreferenced files that may expose source code, credentials or internal data.'],
        ['05', 'Enumerate Infrastructure and Application Admin Interfaces', 'medium', ['config', 'auth'], 'Locate hidden administrative interfaces and verify they are properly protected and not publicly exposed.'],
        ['06', 'HTTP Methods', 'medium', ['config', 'http'], 'Enumerate supported HTTP methods and test for dangerous methods (PUT, DELETE, TRACE) and method-based access control bypass.'],
        ['07', 'HTTP Strict Transport Security', 'medium', ['tls', 'headers'], 'Verify the Strict-Transport-Security header is present with a suitable max-age, includeSubDomains and preload where appropriate.'],
        ['09', 'File Permissions', 'medium', ['config'], 'Review file and directory permissions on the server for overly permissive access to sensitive resources.'],
        ['10', 'Subdomain Takeover', 'high', ['dns', 'cloud'], 'Identify dangling DNS records (CNAME/NS) pointing to deprovisioned services that an attacker could claim.'],
        ['11', 'Cloud Storage', 'high', ['cloud'], 'Verify cloud storage buckets and containers (S3, Azure Blob, GCS) are not publicly readable or writable.'],
        ['12', 'Content Security Policy', 'medium', ['headers', 'xss'], 'Review the CSP for unsafe directives (unsafe-inline, wildcards, missing object-src / base-uri) and bypassable allowlists.'],
        ['13', 'Path Confusion', 'medium', ['config', 'cache'], 'Test whether unexpected path variations are served, enabling web cache deception or access control bypass.'],
        ['14', 'Other HTTP Security Header Misconfigurations', 'low', ['headers'], 'Check X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options and similar headers for absence or misconfiguration.'],
        ['15', 'Feature Flag Security Bypass', 'medium', ['config'], 'Test whether disabled or hidden features can be enabled through client-controlled flags, parameters or headers.']
      ]
    },
    {
      id: 'WSTG-IDNT', name: 'Identity Management', emoji: '🪪', path: '03-Identity_Management/',
      items: [
        ['01', 'Role Definitions', 'medium', ['authz'], 'Identify the roles defined by the application and verify their permissions follow least privilege.'],
        ['02', 'User Registration Process', 'medium', ['auth'], 'Verify identity requirements and validation in registration, and that self-registration cannot be abused to gain privileges.'],
        ['03', 'Account Provisioning Process', 'medium', ['auth', 'authz'], 'Verify which roles can provision, modify and de-provision accounts, and that these actions are authorised and audited.'],
        ['04', 'Account Enumeration and Guessable User Account', 'medium', ['auth'], 'Check whether login, registration or reset responses (content or timing) reveal which usernames are valid.'],
        ['05', 'Weak or Unenforced Username Policy', 'low', ['auth'], 'Determine whether usernames follow a predictable structure that allows valid accounts to be guessed.']
      ]
    },
    {
      id: 'WSTG-ATHN', name: 'Authentication', emoji: '🔐', path: '04-Authentication/',
      items: [
        ['01', 'Credentials Transported over an Encrypted Channel', 'high', ['auth', 'tls'], 'Verify credentials and authentication data are only transmitted over HTTPS and never over plain HTTP.'],
        ['02', 'Default Credentials', 'critical', ['auth'], 'Test for default, vendor-supplied or well-known credentials on the application and its supporting components.'],
        ['03', 'Weak Lock Out Mechanism', 'high', ['auth', 'brute-force'], 'Verify account lockout or throttling resists brute-force attacks without enabling account denial of service.'],
        ['04', 'Bypassing Authentication Schema', 'critical', ['auth'], 'Attempt to reach protected resources without authenticating via forced browsing, parameter tampering, session ID prediction or injection.'],
        ['05', 'Vulnerable Remember Password', 'medium', ['auth'], 'Review "remember me" functionality and browser credential storage for insecure token handling.'],
        ['06', 'Browser Cache Weaknesses', 'medium', ['auth', 'cache'], 'Verify sensitive pages send appropriate Cache-Control headers and cannot be recovered from browser cache or history after logout.'],
        ['07', 'Weak Authentication Methods', 'high', ['auth', 'password'], 'Assess password policy (length, complexity, breached-password checks) and other weak authentication methods.'],
        ['08', 'Weak Security Question Answer', 'medium', ['auth'], 'Assess whether security questions have guessable, researchable or brute-forceable answers.'],
        ['09', 'Weak Password Change or Reset Functionalities', 'high', ['auth'], 'Test reset tokens and change flows for predictability, leakage, reuse, host header poisoning and missing re-authentication.'],
        ['10', 'Weaker Authentication in Alternative Channel', 'high', ['auth', 'mobile', 'api'], 'Identify alternative channels (mobile app, API, legacy sites) and verify they enforce equally strong authentication.'],
        ['11', 'Multi-Factor Authentication (MFA)', 'high', ['auth', 'mfa'], 'Test MFA for bypasses: skipped steps, brute-forceable or reusable codes, weak fallback mechanisms and enrolment flaws.']
      ]
    },
    {
      id: 'WSTG-ATHZ', name: 'Authorization', emoji: '🛂', path: '05-Authorization/',
      items: [
        ['01', 'Directory Traversal File Include', 'high', ['authz', 'lfi'], 'Test file path parameters for path traversal and local or remote file inclusion.'],
        ['02', 'Bypassing Authorization Schema', 'critical', ['authz'], 'Verify every function and resource enforces authorization server-side for each role, including unauthenticated users.'],
        ['03', 'Privilege Escalation', 'critical', ['authz'], 'Test whether a user can gain higher (vertical) or another user\'s (horizontal) privileges by tampering with requests.'],
        ['04', 'Insecure Direct Object References', 'high', ['authz', 'api'], 'Test whether object identifiers can be manipulated to access other users\' data without an authorization check.'],
        ['05', 'OAuth Weaknesses', 'high', ['authz', 'oauth'], 'Review OAuth/OIDC flows for missing state or PKCE, redirect URI validation flaws, token leakage and unsafe grant types.']
      ]
    },
    {
      id: 'WSTG-SESS', name: 'Session Management', emoji: '🍪', path: '06-Session_Management/',
      items: [
        ['01', 'Session Management Schema', 'high', ['session'], 'Analyse session tokens for randomness, predictability and secure generation, transport and storage.'],
        ['02', 'Cookies Attributes', 'medium', ['session', 'cookies'], 'Verify Secure, HttpOnly, SameSite, Domain, Path, expiry and cookie prefixes are set correctly.'],
        ['03', 'Session Fixation', 'high', ['session'], 'Verify a new session identifier is issued on login and on privilege changes.'],
        ['04', 'Exposed Session Variables', 'medium', ['session'], 'Check that session tokens are not exposed in URLs, logs, Referer headers or cached responses.'],
        ['05', 'Cross Site Request Forgery', 'high', ['session', 'csrf'], 'Verify state-changing requests are protected with anti-CSRF tokens, SameSite cookies or equivalent controls.'],
        ['06', 'Logout Functionality', 'medium', ['session'], 'Verify logout invalidates the session server-side and across all relevant components, including SSO.'],
        ['07', 'Session Timeout', 'medium', ['session'], 'Verify idle and absolute session timeouts are enforced server-side.'],
        ['08', 'Session Puzzling', 'medium', ['session'], 'Test whether one session variable is used for several purposes, allowing it to be overloaded to bypass checks.'],
        ['09', 'Session Hijacking', 'high', ['session'], 'Assess whether session tokens can be captured or replayed, e.g. via a missing Secure flag or mixed content.'],
        ['10', 'JSON Web Tokens', 'high', ['session', 'jwt', 'api'], 'Test JWTs for alg=none, weak HMAC secrets, algorithm confusion and missing signature, expiry or claim validation.'],
        ['11', 'Concurrent Sessions', 'low', ['session'], 'Determine how multiple simultaneous sessions per account are handled and whether users can see and revoke them.']
      ]
    },
    {
      id: 'WSTG-INJT', name: 'Injection', emoji: '💉', path: '07-Injection/',
      items: [
        ['01', 'Reflected Cross Site Scripting', 'high', ['xss', 'injection'], 'Test whether input reflected in responses is executed as script in the victim\'s browser.'],
        ['02', 'Stored Cross Site Scripting', 'high', ['xss', 'injection'], 'Test whether stored input is later rendered unsafely to other users.'],
        ['03', 'HTTP Verb Tampering', 'medium', ['http'], 'Test whether changing the HTTP method bypasses access controls or validation.'],
        ['04', 'HTTP Parameter Pollution', 'medium', ['http', 'injection'], 'Supply duplicate parameters to find inconsistent parsing that bypasses validation or alters logic.'],
        ['05', 'SQL Injection', 'critical', ['sqli', 'injection'], 'Test input that reaches SQL queries for error-based, union, boolean, time-based and out-of-band injection.'],
        ['06', 'LDAP Injection', 'high', ['injection'], 'Test input used in LDAP queries for filter injection that alters authentication or data retrieval.'],
        ['07', 'XML Injection', 'high', ['injection', 'xml', 'xxe'], 'Test XML input for tag injection and XML External Entity (XXE) processing.'],
        ['08', 'SSI Injection', 'high', ['injection'], 'Test whether Server-Side Include directives in input are interpreted by the server.'],
        ['09', 'XPath Injection', 'high', ['injection', 'xml'], 'Test input used in XPath queries for injection that bypasses authentication or extracts data.'],
        ['10', 'IMAP SMTP Injection', 'medium', ['injection', 'email'], 'Test mail-related features for injected IMAP/SMTP commands or headers.'],
        ['11', 'Code Injection', 'critical', ['injection', 'rce'], 'Test whether input is evaluated as code by the server-side interpreter (eval, include, etc.).'],
        ['12', 'Command Injection', 'critical', ['injection', 'rce'], 'Test whether input reaches OS shell commands and allows arbitrary command execution.'],
        ['13', 'Format String Injection', 'medium', ['injection'], 'Test whether format specifiers in input are interpreted, causing information disclosure or crashes.'],
        ['14', 'Incubated Vulnerability', 'high', ['injection', 'xss'], 'Test for payloads that are stored and triggered later in another context (e.g. admin panels, reports, logs).'],
        ['15', 'HTTP Response Splitting', 'medium', ['http', 'injection'], 'Test whether CR/LF characters in input can inject headers or split HTTP responses.'],
        ['16', 'HTTP Request Smuggling', 'high', ['http'], 'Test for front-end/back-end disagreement on request boundaries (CL.TE, TE.CL, H2 downgrade).'],
        ['17', 'Host Header Injection', 'medium', ['http'], 'Test whether a manipulated Host or X-Forwarded-Host header affects links, reset emails, routing or caching.'],
        ['18', 'Server-side Template Injection', 'critical', ['injection', 'rce'], 'Test whether input is rendered by a server-side template engine, potentially leading to code execution.'],
        ['19', 'Server-Side Request Forgery', 'high', ['ssrf', 'cloud'], 'Test whether the server can be induced to make requests to internal services or cloud metadata endpoints.'],
        ['20', 'Mass Assignment', 'high', ['api', 'authz'], 'Test whether extra properties in requests (e.g. role, isAdmin) are bound to internal objects.'],
        ['21', 'CSV Injection', 'medium', ['injection'], 'Test whether exported CSV/spreadsheet data can contain formulas executed when opened.'],
        ['22', 'Prototype Pollution', 'high', ['javascript', 'injection'], 'Test whether __proto__ / constructor.prototype in input can modify JavaScript object prototypes.'],
        ['23', 'Insecure Deserialization', 'critical', ['injection', 'rce'], 'Test whether untrusted serialized data is deserialized, enabling object injection or code execution.']
      ]
    },
    {
      id: 'WSTG-ERRH', name: 'Error Handling', emoji: '⚠️', path: '08-Error_Handling/',
      items: [
        ['01', 'Improper Error Handling', 'low', ['errors'], 'Trigger errors and verify responses are generic and do not leak internal details.'],
        ['02', 'Stack Traces', 'low', ['errors'], 'Verify stack traces and debug output are never returned to clients.']
      ]
    },
    {
      id: 'WSTG-CRYP', name: 'Weak Cryptography', emoji: '🔑', path: '09-Weak_Cryptography/',
      items: [
        ['01', 'Weak Transport Layer Security', 'high', ['tls', 'crypto'], 'Review TLS protocol versions, cipher suites, certificates and renegotiation for weaknesses.'],
        ['02', 'Padding Oracle', 'high', ['crypto'], 'Test whether decryption error differences allow a padding oracle attack on encrypted values.'],
        ['03', 'Sensitive Information Sent via Unencrypted Channels', 'high', ['tls', 'crypto'], 'Verify sensitive data is never sent over unencrypted channels (HTTP, plain email, etc.).'],
        ['04', 'Weak Cryptographic Primitives', 'medium', ['crypto'], 'Identify weak algorithms, modes, key sizes, hashing or randomness used to protect data.']
      ]
    },
    {
      id: 'WSTG-BUSL', name: 'Business Logic', emoji: '🧠', path: '10-Business_Logic/',
      items: [
        ['01', 'Business Logic Data Validation', 'medium', ['logic'], 'Verify the application validates logically valid data server-side (e.g. prices, quantities, dates).'],
        ['02', 'Ability to Forge Requests', 'medium', ['logic'], 'Test whether requests can be forged to reach hidden or unintended functionality.'],
        ['03', 'Integrity Checks', 'medium', ['logic'], 'Verify the application protects data integrity against tampering of hidden or non-editable fields.'],
        ['04', 'Process Timing', 'medium', ['logic'], 'Test whether processing time differences leak information or allow race conditions.'],
        ['05', 'Number of Times a Function Can Be Used Limits', 'medium', ['logic'], 'Verify limits on function usage (coupons, votes, transfers) cannot be exceeded, including via race conditions.'],
        ['06', 'Circumvention of Work Flows', 'high', ['logic'], 'Test whether multi-step workflows can be skipped or performed out of order.'],
        ['07', 'Defenses Against Application Misuse', 'medium', ['logic'], 'Assess whether the application detects and responds to abusive or anomalous usage.'],
        ['08', 'Upload of Unexpected File Types', 'medium', ['upload'], 'Verify only expected file types are accepted, using server-side content validation.'],
        ['09', 'Upload of Malicious Files', 'high', ['upload'], 'Test uploads with malicious content (web shells, malware, polyglots, zip bombs) and verify safe handling.'],
        ['10', 'Payment Functionality', 'high', ['logic', 'payment'], 'Test payment flows for price tampering, currency manipulation, replay and callback/webhook forgery.']
      ]
    },
    {
      id: 'WSTG-CLNT', name: 'Client-side', emoji: '🖥️', path: '11-Client-side/',
      items: [
        ['01', 'DOM-Based Cross Site Scripting', 'high', ['xss', 'javascript'], 'Test client-side sources and sinks for DOM-based XSS.', 'DOM-based_Cross_Site_Scripting'],
        ['02', 'JavaScript Execution', 'high', ['xss', 'javascript'], 'Test whether attacker-controlled input can execute JavaScript in the client context.'],
        ['03', 'HTML Injection', 'medium', ['injection'], 'Test whether input is rendered as HTML, allowing content injection.'],
        ['04', 'Client-side URL Redirect', 'medium', ['redirect'], 'Test for open redirects driven by client-side code.'],
        ['05', 'CSS Injection', 'medium', ['injection'], 'Test whether input injected into styles can exfiltrate data or alter the page.'],
        ['06', 'Client-side Resource Manipulation', 'medium', ['javascript'], 'Test whether input controls URLs of resources loaded by the client (scripts, iframes, XHR).'],
        ['07', 'Cross Origin Resource Sharing', 'medium', ['cors', 'api'], 'Review CORS configuration for reflected or wildcard origins with credentials and trusted null origins.'],
        ['09', 'Clickjacking', 'medium', ['headers', 'ui'], 'Verify framing is restricted via frame-ancestors CSP or X-Frame-Options.'],
        ['10', 'WebSockets', 'medium', ['websocket'], 'Test WebSocket origin checks, authentication, authorization and input handling.'],
        ['11', 'Web Messaging', 'medium', ['javascript'], 'Review postMessage usage for missing origin validation and unsafe handling of messages.'],
        ['12', 'Browser Storage', 'medium', ['storage'], 'Check localStorage, sessionStorage, IndexedDB and cookies for sensitive data.'],
        ['13', 'Cross Site Script Inclusion', 'medium', ['javascript'], 'Test whether sensitive data in script/JSON responses can be included cross-origin (XSSI).'],
        ['14', 'Reverse Tabnabbing', 'low', ['ui'], 'Check links opened in new tabs for missing rel="noopener noreferrer".'],
        ['15', 'Client-side Template Injection', 'high', ['injection', 'javascript'], 'Test whether input is evaluated by client-side template frameworks (Angular, Vue, etc.).', 'Client-Side_Template_Injection']
      ]
    },
    {
      id: 'WSTG-APIT', name: 'API Testing', emoji: '🔌', path: '12-API_Testing/',
      items: [
        ['01', 'API Reconnaissance', 'info', ['api', 'recon'], 'Discover API endpoints, versions, documentation (OpenAPI, GraphQL introspection) and authentication schemes.'],
        ['02', 'API Broken Object Level Authorization', 'high', ['api', 'authz'], 'Test whether object IDs in API calls can be changed to access other users\' objects (BOLA).'],
        ['03', 'Excessive Data Exposure', 'high', ['api'], 'Verify API responses return only the data the client needs, not full internal objects.'],
        ['04', 'API Broken Function Level Authorization', 'high', ['api', 'authz'], 'Test whether lower-privileged users can call administrative or privileged API functions (BFLA).'],
        ['99', 'GraphQL', 'medium', ['api', 'graphql'], 'Test GraphQL for introspection exposure, authorization per resolver, batching/depth abuse and injection.']
      ]
    },
    {
      id: 'WSTG-WASM', name: 'WebAssembly Testing', emoji: '🧩', path: '13-WebAssembly_Testing/',
      items: [
        ['01', 'WebAssembly Reconnaissance', 'info', ['wasm', 'recon'], 'Identify WebAssembly modules in use, retrieve and analyse them for exposed functionality and secrets.']
      ]
    }
  ];

  return categories.map(function (c) {
    return {
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      reference: BASE + c.path,
      // Deep link: https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/<cat>/<NN-Title>
      items: c.items.map(function (r) {
        return {
          wstgId: c.id + '-' + r[0],
          title: r[1],
          severity: r[2],
          tags: r[3],
          description: r[4],
          reference: BASE + c.path + r[0] + '-' + (r[5] || r[1].replace(/\s*\(.*?\)/g, '').trim().replace(/\s+/g, '_'))
        };
      })
    };
  });
})();
