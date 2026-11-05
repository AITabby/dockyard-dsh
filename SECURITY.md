# Security boundary

Dockyard DSH runs inside the DSH process and therefore has the permissions of
the host process. The plugin can:

- register an LLM adapter and provider-native request transports;
- read and write provider credentials through the host DSH Credentials service,
  or the macOS Keychain on darwin;
- start provider-owned OAuth CLI commands with isolated temporary profiles;
- call the configured provider endpoints over HTTPS.

Provider-native remote endpoints must use HTTPS. Plain HTTP endpoints are
rejected except for explicit loopback development/test endpoints.

Do not include tokens, OAuth files, Keychain values, or private logs in issue
reports. Report suspected vulnerabilities privately to the repository owner
before public disclosure.
