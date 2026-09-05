import { PACKAGE, TYPERT_DESCRIPTORS, TYPERT_MODEL } from "./dockyard-typert-shared.mjs";

// `schemas` stays empty on purpose: the official dsh-typert-generator emits
// the same empty array for every package face. Parameter validation is owned
// by the strict codecs inside TYPERT_DESCRIPTORS (invocations), which the
// typert registry validates and the remote service applies per call.
export const TYPERT = {
  package: PACKAGE,
  face: "host",
  schemas: [],
  invocations: TYPERT_DESCRIPTORS,
  model: TYPERT_MODEL,
};

export default TYPERT;
