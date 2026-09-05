import { z } from "zod";

const PACKAGE = "@dockyard-dsh/plugin";

const typeSymbol = (name) => `${PACKAGE}/client#${name}`;
const codec = (schema, name) => ({
  mode: "strict",
  typeSymbol: typeSymbol(name),
  schema,
});

const providerRequest = z.object({
  providerId: z.string().min(1).optional(),
});

const loginRequest = z.object({
  providerId: z.string().min(1),
});

const pollRequest = z.object({
  providerId: z.string().min(1),
  sessionId: z.string().min(1),
});

const authorizationCodeRequest = z.object({
  providerId: z.string().min(1),
  sessionId: z.string().min(1),
  code: z.string().min(1),
});

const addRequest = z.object({
  providerId: z.string().min(1),
  candidateId: z.string().min(1).optional(),
});

const policyRequest = z.object({
  providerId: z.string().min(1),
  policy: z.string().min(1),
  defaultAccountId: z.string().min(1).optional(),
});

const useRequest = z.object({
  providerId: z.string().min(1),
  accountId: z.string().min(1),
});

const removeRequest = z.object({
  providerId: z.string().min(1),
  accountId: z.string().min(1),
});

const nativeKeyProviderRequest = z.object({
  providerId: z.string().min(1),
});

const nativeKeyRegisterRequest = z.object({
  providerId: z.string().min(1),
  ref: z.string().min(1),
  label: z.string().max(120).optional(),
});

const nativeKeyRefRequest = z.object({
  providerId: z.string().min(1),
  ref: z.string().min(1),
});

const nativeKeyPolicyRequest = z.object({
  providerId: z.string().min(1),
  policy: z.enum(["manual", "round_robin", "failover"]),
});

const contextWindowRequest = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  accountId: z.string().min(1).optional(),
  keyRef: z.string().min(1).optional(),
});

const contextWindowSetRequest = contextWindowRequest.extend({
  value: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
});

function requestParameter(schema, name) {
  return {
    name: "request",
    wire: "request",
    source: "json",
    codec: codec(schema, name),
  };
}

function descriptor(method, schema, typeName) {
  return {
    id: `${PACKAGE}#dockyard/${method}`,
    service: "dockyardRemote",
    namespace: "dockyard",
    method,
    invocation: { kind: "direct" },
    parameters: schema === undefined ? [] : [schema],
    result: codec(z.unknown(), typeName),
  };
}

export const TYPERT_DESCRIPTORS = Object.freeze([
  descriptor("snapshot", undefined, "DockyardSnapshot"),
  descriptor("refresh", requestParameter(providerRequest, "DockyardProviderRequest"), "DockyardRefreshResult"),
  descriptor("refreshCatalog", requestParameter(providerRequest, "DockyardProviderRequest"), "DockyardRefreshCatalogResult"),
  descriptor("scan", requestParameter(providerRequest, "DockyardProviderRequest"), "DockyardScanResult"),
  descriptor("add", requestParameter(addRequest, "DockyardAddRequest"), "DockyardAddResult"),
  descriptor("login", requestParameter(loginRequest, "DockyardLoginRequest"), "DockyardLoginResult"),
  descriptor("poll", requestParameter(pollRequest, "DockyardPollRequest"), "DockyardPollResult"),
  descriptor("submitAuthorizationCode", requestParameter(authorizationCodeRequest, "DockyardAuthorizationCodeRequest"), "DockyardAuthorizationCodeResult"),
  descriptor("cancel", requestParameter(pollRequest, "DockyardPollRequest"), "DockyardCancelResult"),
  descriptor("setPolicy", requestParameter(policyRequest, "DockyardPolicyRequest"), "DockyardPolicyResult"),
  descriptor("use", requestParameter(useRequest, "DockyardUseRequest"), "DockyardUseResult"),
  descriptor("removeAccount", requestParameter(removeRequest, "DockyardRemoveRequest"), "DockyardRemoveResult"),
  descriptor("nativeKeyStatus", requestParameter(nativeKeyProviderRequest, "DockyardNativeKeyProviderRequest"), "DockyardNativeKeyStatus"),
  descriptor("nativeKeyRefresh", requestParameter(nativeKeyProviderRequest, "DockyardNativeKeyProviderRequest"), "DockyardNativeKeyRefresh"),
  descriptor("nativeKeyRegister", requestParameter(nativeKeyRegisterRequest, "DockyardNativeKeyRegisterRequest"), "DockyardNativeKeyRegister"),
  descriptor("nativeKeyUnregister", requestParameter(nativeKeyRefRequest, "DockyardNativeKeyRefRequest"), "DockyardNativeKeyUnregister"),
  descriptor("nativeKeySetPolicy", requestParameter(nativeKeyPolicyRequest, "DockyardNativeKeyPolicyRequest"), "DockyardNativeKeySetPolicy"),
  descriptor("getContextWindowOverride", requestParameter(contextWindowRequest, "DockyardContextWindowRequest"), "DockyardContextWindowOverride"),
  descriptor("setContextWindowOverride", requestParameter(contextWindowSetRequest, "DockyardContextWindowSetRequest"), "DockyardContextWindowOverride"),
]);

export const TYPERT_MODEL = Object.freeze({
  services: [
    {
      description: "Dockyard provider account, OAuth, quota, and selection management.",
      summary: "Provider-aware Dockyard account management for the native DSH composer.",
      tags: [],
      key: "dockyardRemote",
      exportName: "DockyardRemoteService",
      members: TYPERT_DESCRIPTORS.map((entry) => ({
        kind: "method",
        name: entry.method,
        signature: `${entry.method}(...): unknown`,
      })),
      types: [],
    },
  ],
  events: [],
  objects: [],
});

export { PACKAGE };
