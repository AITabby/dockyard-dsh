import * as React from "react";

import { createSnapshotStore } from "@deepseek-ai/dsh-client-runtime/client";

import { TYPERT_REMOTE } from "./dockyard-typert.remote.mjs";
import {
  DOCKYARD_LOCALE_NS,
  DOCKYARD_LOCALES,
  translate as translateText,
} from "./dockyard-locale.mjs";
import { NativeKeyPoolController } from "./native-key-pool.mjs";

const h = React.createElement;
const {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} = React;

const STYLE_ID = "dockyard-dsh-account-control";
const POLICY_KEYS = Object.freeze({
  manual: "policy.manual",
  sticky_session: "policy.sticky_session",
  round_robin: "policy.round_robin",
  failover: "policy.failover",
});

function text(t, key, params) {
  return translateText(t, key, params);
}

function policyLabel(t, policy) {
  return text(t, POLICY_KEYS[policy] ?? "policy.manual");
}

const DOCKYARD_CHEVRON_PATH = "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z";

const CSS = `
.dockyard-dsh-anchor{position:relative;display:inline-flex;align-items:center;min-width:0;z-index:25}
/* The native model menu stays compact; live capacities remain in the Dockyard
   popup, where they belong with the provider/account state. */
button[role="menuitemradio"] [class$="_description"]{display:none!important}
.dockyard-dsh-model-group-toggle{display:flex!important;align-items:center;justify-content:space-between;gap:10px;min-height:26px;padding:4px 12px!important;border-radius:7px;cursor:pointer;user-select:none;outline:0}
.dockyard-dsh-model-group-toggle:hover,.dockyard-dsh-model-group-toggle:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#fff)}
.dockyard-dsh-model-group-toggle .dockyard-dsh-model-group-chevron{margin-left:auto}
section[data-dockyard-model-group-collapsed="true"]>[role="menuitemradio"]{display:none!important}
.dockyard-dsh-trigger{display:inline-flex;align-items:center;gap:8px;max-width:260px;height:28px;padding:0 10px;border:0;border-radius:999px;color:var(--dsw-alias-label-secondary,#c7ccd5);background:transparent;cursor:pointer;font:500 13px/20px Inter,var(--dsw-font-family,sans-serif);white-space:nowrap}
.dockyard-dsh-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#fff)}
.dockyard-dsh-trigger:focus-visible{outline:2px solid var(--dsw-alias-border-l3,#8fa3c7);outline-offset:1px}
.dockyard-dsh-trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#fff)}
.dockyard-dsh-add-trigger{display:inline-flex;align-items:center;justify-content:center;gap:3px;height:28px;margin-left:2px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,#c7ccd5);cursor:pointer;font:500 12px/20px Inter,var(--dsw-font-family,sans-serif);white-space:nowrap}
.dockyard-dsh-add-trigger:hover,.dockyard-dsh-add-trigger:focus-visible{border-color:rgba(121,214,200,.6);background:rgba(121,214,200,.09);color:var(--dsw-alias-label-primary,#fff)}
.dockyard-dsh-add-trigger:focus-visible{outline:2px solid var(--dsw-alias-border-l3,#8fa3c7);outline-offset:1px}
.dockyard-dsh-dot{display:inline-block;width:6px;height:6px;flex:none;border-radius:50%;background:var(--dsw-alias-label-caption,#8b93a1);margin-top:0.5px}
.dockyard-dsh-dot[data-live=true]{background:#79d6c8;box-shadow:0 0 8px rgba(121,214,200,.8)}
.dockyard-dsh-dot[data-loading=true]{background:#cbb7ff;animation:dockyard-dsh-pulse 1s ease-in-out infinite}
.dockyard-dsh-label{min-width:0;overflow:hidden;text-overflow:ellipsis}
.dockyard-dsh-summary{min-width:0;margin-left:4px;color:var(--dsw-alias-label-caption,#8b93a1);font-size:12px;font-weight:400;line-height:18px;overflow:hidden;text-overflow:ellipsis}
.dockyard-dsh-chevron{display:inline-flex;width:14px;height:14px;flex:none;align-items:center;justify-content:center;color:var(--dsw-alias-label-caption,#8b93a1);transition:transform 140ms ease;transform-origin:center}
.dockyard-dsh-chevron[data-open=true]{transform:rotate(180deg)}
.dockyard-dsh-chevron svg{display:block;width:14px;height:14px}
.dockyard-dsh-popup{position:fixed;z-index:1000;left:var(--dockyard-dsh-popup-left,14px);top:var(--dockyard-dsh-popup-top,14px);right:auto;bottom:var(--dockyard-dsh-popup-bottom,auto);box-sizing:border-box;width:min(480px,calc(100vw - 28px));max-height:var(--dockyard-dsh-popup-max-height,min(560px,calc(100vh - 28px)));max-height:var(--dockyard-dsh-popup-max-height,min(560px,calc(100dvh - 28px)));overflow:hidden;display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:14px;background:var(--dsw-specific-menu,#2d2d31);box-shadow:var(--dsw-shadow-lv3,0 16px 50px rgba(0,0,0,.4));color:var(--dsw-alias-label-primary,#f5f7fb);font:400 12px/18px Inter,var(--dsw-font-family,sans-serif);text-align:left}
.dockyard-dsh-popup-scroll{min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px;padding-right:1px}
.dockyard-dsh-provider-list{display:flex;flex-direction:column;gap:6px}
.dockyard-dsh-provider-row{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:8px 9px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));border-radius:10px;background:rgba(255,255,255,.035);color:inherit;cursor:pointer;font:inherit;text-align:left}
.dockyard-dsh-provider-row:hover,.dockyard-dsh-provider-row[data-current=true]{border-color:rgba(121,214,200,.5);background:rgba(121,214,200,.08)}
.dockyard-dsh-provider-row:focus-visible{outline:2px solid var(--dsw-alias-border-l3,#8fa3c7);outline-offset:1px}
.dockyard-dsh-provider-row-copy{min-width:0;flex:1}
.dockyard-dsh-provider-row-name{overflow:hidden;color:var(--dsw-alias-label-primary,#f5f7fb);font-size:12px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}
.dockyard-dsh-provider-row-meta{margin-top:2px;overflow:hidden;color:var(--dsw-alias-label-caption,#8b93a1);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.dockyard-dsh-provider-row-arrow{flex:none;color:var(--dsw-alias-label-caption,#8b93a1);font-size:18px;line-height:18px}
.dockyard-dsh-head{display:flex;align-items:flex-start;gap:10px;padding-bottom:2px}
.dockyard-dsh-head-copy{min-width:0;flex:1}
.dockyard-dsh-eyebrow{color:#94d9d0;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.dockyard-dsh-title{margin-top:2px;font-size:16px;font-weight:650;line-height:22px}
.dockyard-dsh-model{margin-top:2px;overflow:hidden;color:var(--dsw-alias-label-tertiary,#a9b0ba);text-overflow:ellipsis;white-space:nowrap}
.dockyard-dsh-model-context{margin-top:2px;color:var(--dsw-alias-label-caption,#8b93a1);font-size:10px;line-height:15px;text-align:left}
.dockyard-dsh-close{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:none;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-tertiary,#a9b0ba);cursor:pointer;font-size:0;line-height:0}
.dockyard-dsh-close::before{content:"×";display:block;font:600 18px/18px Inter,var(--dsw-font-family,sans-serif);transform:translateY(-0.5px)}
.dockyard-dsh-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#fff)}
.dockyard-dsh-status{display:flex;align-items:center;gap:0;min-height:28px;padding:6px 0;border-radius:8px;background:var(--dsw-alias-bg-module-platform,rgba(255,255,255,.06));color:var(--dsw-alias-label-tertiary,#a9b0ba)}
.dockyard-dsh-status[data-error=true]{background:rgba(255,104,104,.11);color:var(--dsw-alias-state-error-primary,#ff7a7a)}
.dockyard-dsh-status[data-success=true]{background:rgba(156,229,220,.08);color:#9ce5dc}
.dockyard-dsh-status-copy{display:block;align-self:center;min-width:0;flex:1;overflow-wrap:anywhere;white-space:normal;text-align:left}
.dockyard-dsh-auth-status{align-items:flex-start}
.dockyard-dsh-auth-status .dockyard-dsh-status-copy{white-space:normal;overflow-wrap:anywhere;line-height:18px}
.dockyard-dsh-auth-status .dockyard-dsh-auth-diagnostic{flex-basis:100%;color:var(--dsw-alias-state-error-primary,#ff7a7a)}
.dockyard-dsh-login-guide{display:flex;flex-direction:column;gap:6px;padding:9px 10px;border:1px solid rgba(121,214,200,.35);border-radius:9px;background:rgba(121,214,200,.07);text-align:left}
.dockyard-dsh-login-guide-title{color:#b8eee8;font-size:11px;font-weight:650;line-height:17px}
.dockyard-dsh-login-guide-copy{color:var(--dsw-alias-label-tertiary,#a9b0ba);font-size:10px;line-height:15px}
.dockyard-dsh-login-guide-steps{display:flex;flex-direction:column;gap:5px;margin:1px 0 0;padding:0;list-style:none}
.dockyard-dsh-login-guide-step{display:flex;align-items:flex-start;gap:7px;color:var(--dsw-alias-label-secondary,#c7ccd5);font-size:10px;line-height:15px}
.dockyard-dsh-login-guide-number{display:inline-flex;width:16px;height:16px;flex:none;align-items:center;justify-content:center;border-radius:50%;background:rgba(121,214,200,.2);color:#b8eee8;font-size:9px;font-weight:700}
.dockyard-dsh-login-guide-error{color:#ff9a83;font-size:10px;line-height:15px}
.dockyard-dsh-login-guide-code{display:flex;align-items:center;gap:6px;margin-top:2px}
.dockyard-dsh-login-guide-code input{min-width:0;flex:1;height:28px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:7px;background:rgba(0,0,0,.12);color:var(--dsw-alias-label-primary,#f5f7fb);font:400 11px/20px Inter,var(--dsw-font-family,sans-serif)}
.dockyard-dsh-login-guide-code input:focus{border-color:#8ecfc7;outline:0}
.dockyard-dsh-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dockyard-dsh-action{height:28px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#c7ccd5);cursor:pointer;font:500 11px/20px Inter,var(--dsw-font-family,sans-serif);white-space:nowrap;flex:none}
.dockyard-dsh-action:hover:not(:disabled){border-color:#8ecfc7;background:rgba(121,214,200,.09);color:#b8eee8}
.dockyard-dsh-action:disabled{cursor:default;opacity:.45}
.dockyard-dsh-action-primary{border-color:rgba(121,214,200,.55);color:#a5e6dd}
.dockyard-dsh-action-danger{border-color:rgba(255,125,110,.48);color:#ff9c91}
.dockyard-dsh-field{display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:8px 9px;border-radius:8px;background:rgba(255,255,255,.045);text-align:left}
.dockyard-dsh-field-label{flex:1;color:var(--dsw-alias-label-tertiary,#a9b0ba);text-align:left}
.dockyard-dsh-select{max-width:170px;height:27px;padding:0 7px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:6px;background:var(--dsw-specific-menu,#2d2d31);color:var(--dsw-alias-label-primary,#f5f7fb);font:500 11px/20px Inter,var(--dsw-font-family,sans-serif)}
.dockyard-dsh-section{display:flex;flex-direction:column;gap:6px}
.dockyard-dsh-section-title{display:flex;width:100%;box-sizing:border-box;flex-direction:column;align-items:flex-start;gap:1px;color:var(--dsw-alias-label-tertiary,#a9b0ba);font-size:10px;font-weight:700;letter-spacing:1.2px;line-height:18px;text-transform:uppercase;text-align:left}
.dockyard-dsh-section-title>span:first-child{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dockyard-dsh-section-value{display:block;min-width:0;max-width:100%;margin:0;color:var(--dsw-alias-label-caption,#8b93a1);font-size:11px;font-weight:400;letter-spacing:0;line-height:16px;text-transform:none;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dockyard-dsh-tier-list{display:flex;gap:5px;flex-wrap:wrap}
.dockyard-dsh-tier{min-height:25px;padding:2px 8px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:999px;background:transparent;color:var(--dsw-alias-label-tertiary,#a9b0ba);cursor:pointer;font:500 11px/18px Inter,var(--dsw-font-family,sans-serif)}
.dockyard-dsh-tier[data-active=true]{border-color:rgba(121,214,200,.65);background:rgba(121,214,200,.12);color:#a5e6dd}
.dockyard-dsh-tier:disabled{cursor:default;opacity:.55}
.dockyard-dsh-account{display:flex;flex-direction:column;gap:7px;padding:9px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));border-radius:10px;background:rgba(255,255,255,.035)}
.dockyard-dsh-account[data-current=true]{border-color:rgba(121,214,200,.45);background:rgba(121,214,200,.065)}
.dockyard-dsh-account-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dockyard-dsh-account-identity{min-width:0;flex:1}
.dockyard-dsh-account-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,#f5f7fb);font-size:12px;font-weight:600}
.dockyard-dsh-account-id{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-caption,#8b93a1);font-size:10px}
.dockyard-dsh-account-actions{display:flex;align-items:center;gap:5px;flex:none;margin-left:auto}
.dockyard-dsh-account-use{height:25px;padding:0 7px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:6px;background:transparent;color:#a5e6dd;cursor:pointer;font:500 10px/18px Inter,var(--dsw-font-family,sans-serif);white-space:nowrap}
.dockyard-dsh-account-use:hover:not(:disabled){background:rgba(121,214,200,.12)}
.dockyard-dsh-account-use:disabled{cursor:default;opacity:.5}
.dockyard-dsh-account-remove{height:25px;padding:0 7px;border:1px solid rgba(255,122,122,.35);border-radius:6px;background:transparent;color:#ff9a83;cursor:pointer;font:500 10px/18px Inter,var(--dsw-font-family,sans-serif);white-space:nowrap}
.dockyard-dsh-account-remove:hover:not(:disabled){border-color:rgba(255,122,122,.7);background:rgba(255,104,104,.12)}
.dockyard-dsh-account-remove:disabled{cursor:default;opacity:.5}
.dockyard-dsh-account-meta{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-caption,#8b93a1);font-size:10px;flex-wrap:wrap}
.dockyard-dsh-health{color:#9ce5dc}.dockyard-dsh-health[data-bad=true]{color:#ff9a83}
.dockyard-dsh-account-note{padding:4px 6px;border-radius:6px;background:rgba(203,183,255,.07);color:var(--dsw-alias-label-caption,#8b93a1);font-size:10px;line-height:15px;text-align:left}
.dockyard-dsh-account-error{max-width:100%;overflow:hidden;color:#ff9a83;font-size:10px;line-height:15px;text-align:left;text-overflow:ellipsis;white-space:nowrap}
.dockyard-dsh-quota{display:flex;flex-direction:column;gap:4px}
.dockyard-dsh-quota-row{display:flex;align-items:center;gap:8px}
.dockyard-dsh-quota-copy{min-width:0;flex:1;color:var(--dsw-alias-label-tertiary,#a9b0ba);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dockyard-dsh-quota-value{flex:none;color:var(--dsw-alias-label-primary,#f5f7fb);font-size:11px}
.dockyard-dsh-quota-track{height:4px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.1)}
.dockyard-dsh-quota-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#8edbd1,#b59bff)}
.dockyard-dsh-muted{padding:4px 2px;color:var(--dsw-alias-label-caption,#8b93a1);text-align:left}
.dockyard-dsh-candidates{display:flex;flex-direction:column;gap:5px}
.dockyard-dsh-candidate{display:flex;align-items:center;gap:7px;padding:6px 7px;border-radius:7px;background:rgba(255,255,255,.04)}
.dockyard-dsh-candidate-copy{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#c7ccd5)}
.dockyard-dsh-key-notice{padding:7px 8px;border-radius:8px;background:rgba(203,183,255,.08);color:var(--dsw-alias-label-tertiary,#a9b0ba);line-height:17px;text-align:left}
.dockyard-dsh-key-form{--dockyard-dsh-key-control-height:32px;display:flex;width:100%;box-sizing:border-box;align-self:stretch;align-items:stretch;flex-direction:column;gap:6px;padding:9px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));border-radius:10px;background:rgba(255,255,255,.035)}
.dockyard-dsh-key-form-row{display:flex;width:100%;min-width:0;min-height:var(--dockyard-dsh-key-control-height);align-items:stretch;gap:6px}
.dockyard-dsh-key-input{display:block;box-sizing:border-box;width:100%;min-width:0;flex:1 1 auto;height:var(--dockyard-dsh-key-control-height);min-height:var(--dockyard-dsh-key-control-height);margin:0;padding:0 8px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:7px;background:rgba(0,0,0,.12);color:var(--dsw-alias-label-primary,#f5f7fb);font:400 11px/20px Inter,var(--dsw-font-family,sans-serif)}
.dockyard-dsh-key-form>.dockyard-dsh-key-input{flex:0 0 auto}
.dockyard-dsh-key-input::placeholder{color:var(--dsw-alias-label-caption,#8b93a1)}
.dockyard-dsh-key-input:focus{border-color:rgba(121,214,200,.7);outline:0;box-shadow:0 0 0 2px rgba(121,214,200,.12)}
.dockyard-dsh-key-save{box-sizing:border-box;height:var(--dockyard-dsh-key-control-height);min-height:var(--dockyard-dsh-key-control-height);padding:0 9px;border:1px solid rgba(121,214,200,.55);border-radius:7px;background:rgba(121,214,200,.08);color:#a5e6dd;cursor:pointer;font:500 11px/20px Inter,var(--dsw-font-family,sans-serif);white-space:nowrap}
.dockyard-dsh-key-save:hover:not(:disabled){background:rgba(121,214,200,.16)}
.dockyard-dsh-key-save:disabled{cursor:default;opacity:.45}
.dockyard-dsh-key-ref{overflow:hidden;color:var(--dsw-alias-label-caption,#8b93a1);font:400 9px/14px ui-monospace,SFMono-Regular,Menlo,monospace;text-overflow:ellipsis;white-space:nowrap}
.dockyard-dsh-key-source{color:var(--dsw-alias-label-caption,#8b93a1);font-size:10px}
/* --- wide popup mode --------------------------------------------------- */
.dockyard-dsh-popup[data-size="wide"]{width:min(720px,calc(100vw - 28px));max-height:var(--dockyard-dsh-popup-max-height,min(720px,calc(100dvh - 28px)))}
/* --- key table ---------------------------------------------------------- */
.dockyard-dsh-keytable{display:flex;flex-direction:column;gap:4px}
.dockyard-dsh-keyrow{overflow:hidden;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));border-radius:9px;background:rgba(255,255,255,.035)}
.dockyard-dsh-keyrow[data-current=true]{border-color:rgba(121,214,200,.45);background:rgba(121,214,200,.06)}
.dockyard-dsh-keyrow[data-open=true]{border-color:rgba(121,214,200,.35)}
.dockyard-dsh-keyrow-head{display:grid;grid-template-columns:minmax(0,1fr) auto 14px;align-items:center;gap:10px;width:100%;box-sizing:border-box;padding:7px 9px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dockyard-dsh-keyrow-head:focus-visible{outline:2px solid var(--dsw-alias-border-l3,#8fa3c7);outline-offset:-2px}
.dockyard-dsh-keyrow-identity{min-width:0;display:flex;flex-direction:column;gap:1px}
.dockyard-dsh-keyrow-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#f5f7fb)}
.dockyard-dsh-keyrow-ref{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-caption,#8b93a1);font:400 9px/14px ui-monospace,SFMono-Regular,Menlo,monospace}
.dockyard-dsh-keyrow-state{flex:none;font-size:10px;line-height:16px;color:#9ce5dc}
.dockyard-dsh-keyrow-state[data-bad=true]{color:#ff9a83}
.dockyard-dsh-keyrow-chevron{color:var(--dsw-alias-label-caption,#8b93a1);transition:transform 140ms ease}
.dockyard-dsh-keyrow-chevron[data-open=true]{transform:rotate(180deg)}
.dockyard-dsh-keyrow-detail{display:flex;flex-direction:column;gap:8px;padding:9px;border-top:1px solid rgba(255,255,255,.07)}
.dockyard-dsh-keyrow-detail-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dockyard-dsh-keyrow-detail-actions .spacer{flex:1}
/* --- token usage stats --------------------------------------------------- */
/* --- collapsible folds ---------------------------------------------------- */
.dockyard-dsh-fold{border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));border-radius:9px;background:rgba(255,255,255,.03)}
.dockyard-dsh-fold>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:inherit;cursor:pointer;list-style:none;color:var(--dsw-alias-label-tertiary,#a9b0ba);font-size:10px;font-weight:700;letter-spacing:1.2px;line-height:18px;text-transform:uppercase}
.dockyard-dsh-fold>summary::-webkit-details-marker{display:none}
.dockyard-dsh-fold>summary::after{content:"›";flex:none;color:var(--dsw-alias-label-caption,#8b93a1);font-size:13px;transform:rotate(90deg);transition:transform 140ms ease}
.dockyard-dsh-fold[open]>summary::after{transform:rotate(-90deg)}
.dockyard-dsh-fold>summary:hover{color:#b8eee8}
.dockyard-dsh-fold-body{display:flex;flex-direction:column;gap:6px;padding:0 9px 9px}
@keyframes dockyard-dsh-pulse{0%,100%{opacity:.45}50%{opacity:1}}
/* --- narrow viewport fallback --------------------------------------------- */
@media (max-width:560px){
  .dockyard-dsh-popup{left:8px!important;top:auto!important;bottom:8px!important;width:calc(100vw - 16px)!important;max-height:calc(100dvh - 16px)!important}
  .dockyard-dsh-keyrow-head{grid-template-columns:minmax(0,1fr) auto 14px}
  .dockyard-dsh-account-actions{margin-left:0}
}
`;

function installStyles() {
  if (typeof document === "undefined" || document.querySelector(`style[data-dockyard-dsh="${STYLE_ID}"]`)) return;
  const tag = document.createElement("style");
  tag.dataset.dockyardDsh = STYLE_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}

const modelGroupFoldState = new Map();

function modelMenuSections(menu) {
  return [...menu.querySelectorAll('section[role="group"]')].filter((section) => section.closest('[role="menu"]') === menu);
}

function syncModelGroupChevron(title, open) {
  let icon = title.querySelector(":scope > .dockyard-dsh-model-group-chevron");
  if (!icon) {
    icon = document.createElement("span");
    icon.className = "dockyard-dsh-chevron dockyard-dsh-model-group-chevron";
    icon.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", DOCKYARD_CHEVRON_PATH);
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    icon.appendChild(svg);
    title.appendChild(icon);
  }
  icon.dataset.open = String(open);
}

function syncModelMenuGroups(menu) {
  const english = menu.getAttribute("aria-label") === "Model and reasoning effort";
  for (const section of modelMenuSections(menu)) {
    const labelledBy = section.getAttribute("aria-labelledby");
    const title = [...section.children].find((child) => child.id === labelledBy)
      ?? section.querySelector(".dockyard-dsh-model-group-toggle");
    if (!title) continue;
    const options = [...section.children].filter((child) => child.getAttribute("role") === "menuitemradio");
    if (options.length === 0) continue;
    const key = `${title.textContent?.trim() ?? "provider"}`;
    const stored = modelGroupFoldState.get(key);
    // Large live catalogs stay collapsed even when the current selection is
    // in that provider; the composer already shows the selected model.
    const collapsed = stored === undefined ? options.length > 8 : stored;
    modelGroupFoldState.set(key, collapsed);
    section.dataset.dockyardModelGroupCollapsed = String(collapsed);
    title.classList.add("dockyard-dsh-model-group-toggle");
    title.setAttribute("role", "button");
    title.setAttribute("tabindex", "0");
    title.setAttribute("aria-expanded", String(!collapsed));
    title.setAttribute("title", collapsed
      ? (english ? "Expand model" : "展开模型")
      : (english ? "Collapse model" : "折叠模型"));
    syncModelGroupChevron(title, !collapsed);
  }
}

/**
 * DSH owns the model menu markup, so provider grouping is decorated at the
 * boundary instead of duplicating or hard-coding the model catalog. The
 * section/title roles are stable API surface; generated CSS classes are not
 * used for the behavior.
 */
function installModelMenuFolding() {
  if (typeof document === "undefined" || !document.body || typeof MutationObserver === "undefined") return () => {};
  const boundMenus = new Set();
  const toggle = (event) => {
    const menu = event.currentTarget;
    const title = event.target?.closest?.(".dockyard-dsh-model-group-toggle");
    if (!title || !menu.contains(title)) return;
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const section = title.closest('section[role="group"]');
    if (!section) return;
    const key = `${title.textContent?.trim() ?? "provider"}`;
    const collapsed = modelGroupFoldState.get(key) === true;
    modelGroupFoldState.set(key, !collapsed);
    syncModelMenuGroups(menu);
  };
  const sync = () => {
    for (const menu of document.querySelectorAll('[role="menu"]')) {
      const label = menu.getAttribute("aria-label") ?? "";
      if (label !== "模型与推理等级" && label !== "Model and reasoning effort") continue;
      if (!boundMenus.has(menu)) {
        menu.addEventListener("click", toggle);
        menu.addEventListener("keydown", toggle);
        boundMenus.add(menu);
      }
      syncModelMenuGroups(menu);
    }
  };
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
  sync();
  return () => {
    observer.disconnect();
    for (const menu of boundMenus) {
      menu.removeEventListener("click", toggle);
      menu.removeEventListener("keydown", toggle);
    }
    boundMenus.clear();
  };
}

function useSnapshot(store) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

function errorText(error, t) {
  if (error instanceof Error) return error.message;
  return String(error ?? text(t, "error.unknown"));
}

function refreshResultMessage(result, t) {
  if (!Array.isArray(result)) return null;
  const failures = result.reduce((count, entry) => count + (Array.isArray(entry?.diagnostics) && entry.diagnostics.length > 0 ? 1 : 0), 0);
  if (result.length === 0) return text(t, "status.noConnectedAccounts");
  if (failures === 0) return text(t, "status.refreshedAccounts", { count: result.length });
  return text(t, "status.refreshPartial", {
    success: result.length - failures,
    total: result.length,
    failures,
  });
}

function unwrapRemote(response, t) {
  if (response?.ok === true) return response.value;
  if (response?.ok === false) {
    const detail = response.error?.message ?? response.error?.code ?? text(t, "error.remoteNotMounted", { method: "remote operation" });
    throw new Error(detail);
  }
  return response;
}

function providerFromSnapshot(snapshot, providerId) {
  return snapshot?.providers?.find((provider) => provider.providerId === providerId) ?? null;
}

function providerDisplayName(providerId, manifest, t) {
  if (providerId === "antigravity") return "Antigravity";
  if (providerId === "minimax" || providerId === "minimax-cn") return "MiniMax";
  if (providerId === "deepseek" || providerId === "deepseek-official") return "DeepSeek";
  if (providerId === "openrouter") return "OpenRouter";
  return manifest?.displayName ?? providerId ?? text(t, "value.provider");
}

function displayModelId(providerId, modelId) {
  const value = String(modelId ?? "");
  if (providerId === "antigravity") return value.replace(/^gemini[-_:]/i, "");
  return value;
}

function connectedAccountSignature(snapshot) {
  if (!Array.isArray(snapshot?.providers)) return "";
  return snapshot.providers.map((provider) => [
    provider.providerId,
    ...(Array.isArray(provider.accounts) ? provider.accounts.map((account) => account?.accountId).filter(Boolean).sort() : []),
  ].join(":")).join("|");
}

function formatDate(value, t) {
  if (!value) return text(t, "value.notReturned");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatNumber(value, t) {
  if (value === null || value === undefined) return text(t, "value.unknown");
  return typeof value === "number" ? new Intl.NumberFormat().format(value) : String(value);
}

function shortRef(ref) {
  const value = String(ref ?? "");
  if (value.length <= 28) return value;
  return `${value.slice(0, 16)}…${value.slice(-8)}`;
}

function quotaWindowRows(quota, t) {
  if (!quota || typeof quota !== "object") return [];
  if (Array.isArray(quota.windows) && quota.windows.length > 0) return quota.windows;
  if (quota.remaining !== null || quota.limit !== null || quota.resetAt) return [{
    id: "quota",
    name: quota.unit ?? text(t, "value.quota"),
    remaining: quota.remaining,
    limit: quota.limit,
    unit: quota.unit,
    resetAt: quota.resetAt,
    updatedAt: quota.updatedAt,
  }];
  return [];
}

function quotaRowsForAccount(account, t) {
  return quotaWindowRows(account?.quota, t);
}

function quotaPercent(window) {
  if (typeof window?.remaining !== "number" || typeof window?.limit !== "number" || window.limit <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((window.remaining / window.limit) * 100)));
}

function quotaSummary(account, t) {
  const health = account?.health?.status;
  if (health === "expired") return text(t, "health.expired");
  if (health === "exhausted") return text(t, "health.exhausted");
  if (health === "degraded" && account?.health?.lastError) return text(t, "health.degraded");
  const first = quotaRowsForAccount(account, t)[0];
  const percent = quotaPercent(first);
  if (percent !== null) return `${percent}%`;
  if (first?.remaining !== null && first?.remaining !== undefined) return formatNumber(first.remaining, t);
  if (account?.resources?.quotaDiagnostic) return text(t, "value.quota");
  return account ? text(t, "summary.connected") : text(t, "summary.notConnected");
}

function providerAccount(provider) {
  if (provider?.defaultAccountId) {
    return provider.accounts?.find((account) => account.accountId === provider.defaultAccountId) ?? null;
  }
  return provider?.accounts?.length === 1 ? provider.accounts[0] : null;
}

function providerOverviewSummary(provider, t) {
  const accounts = provider?.accounts ?? [];
  if (accounts.length === 0) return text(t, "summary.notConnected");
  const selected = providerAccount(provider);
  const summary = selected ? quotaSummary(selected, t) : text(t, "summary.connected");
  return text(t, "summary.accounts", { count: accounts.length, summary });
}

function accountName(account, t) {
  return account?.email ?? account?.displayName ?? account?.accountId ?? text(t, "value.unknown");
}

function accountIdentityLine(account, t) {
  const identitySource = account?.resources?.identitySource;
  if (account?.email && account?.resources?.authSource === "official_cursor_browser_oauth") return text(t, "identity.cursorBrowser");
  if (["official_cli_auth_status", "official_client_auth_status"].includes(identitySource)) return text(t, "identity.officialLogin");
  if (account?.resources?.sessionFingerprint) return text(t, "identity.sessionFingerprint", { fingerprint: account.resources.sessionFingerprint });
  return account?.accountId ?? text(t, "value.unknown");
}

function healthLabel(status, t) {
  return status === "healthy" ? text(t, "health.healthy")
    : status === "degraded" ? text(t, "health.degraded")
      : status === "cooldown" ? text(t, "health.cooldown")
        : status === "expired" ? text(t, "health.expired")
          : status === "exhausted" ? text(t, "health.exhausted")
            : status ?? text(t, "health.unknown");
}

class DockyardClientController {
  remote;
  store = createSnapshotStore({
    snapshot: null,
    status: "idle",
    action: null,
    providerId: null,
    error: null,
    message: null,
    scan: null,
    auth: null,
  });
  snapshotPromise = null;
  refreshPromises = new Map();
  authTimers = new Map();

  constructor(remote, t) {
    this.remote = remote;
    this.t = t;
  }

  setState(next) {
    this.store.update((state) => Object.assign(state, next));
  }

  applyValue(value, providerId = null, { preserveControl = false } = {}) {
    const hasEnvelope = value && typeof value === "object" && Object.hasOwn(value, "snapshot");
    const snapshot = hasEnvelope ? value.snapshot : value;
    if (snapshot?.providers) this.setState({ snapshot });
    if (!hasEnvelope) return value;
    const result = value.result;
    if (preserveControl) {
      const next = {};
      if (result?.providers) next.scan = result;
      if (result?.scan?.providers) next.scan = result.scan;
      this.setState(next);
      return result;
    }
    const next = {
      providerId,
      action: null,
      status: "ready",
      error: null,
      // Login status belongs to the previous auth operation. Clear it when a
      // refresh/scan/add/remove result arrives so an old "unsupported" notice
      // cannot survive after the account was removed or discovered again.
      auth: null,
    };
    if (result?.status) {
      next.auth = result.status === "completed" ? null : {
        providerId: result.providerId ?? providerId,
        sessionId: result.sessionId ?? null,
        status: result.status,
        authorizationUrl: result.authorizationUrl ?? null,
        instructions: result.instructions ?? null,
        inputRequired: result.inputRequired === true,
        authorizationCodeRequired: result.authorizationCodeRequired === true,
        diagnostic: result.diagnostic ?? null,
      };
      if (result.diagnostic) next.message = result.diagnostic;
      else if (result.instructions && result.status !== "opened") next.message = result.instructions;
      else if (result.status === "completed") next.message = text(this.t, "status.oauthCompleted");
      else if (["failed", "error"].includes(result.status)) {
        next.error = result.diagnostic ?? result.instructions ?? text(this.t, "status.oauthFailed");
      }
    }
    if (result?.providers) next.scan = result;
    if (result?.scan?.providers) next.scan = result.scan;
    this.setState(next);
    return result;
  }

  async call(method, ...args) {
    const fn = this.remote?.[method];
    if (typeof fn !== "function") throw new Error(text(this.t, "error.remoteNotMounted", { method }));
    return unwrapRemote(await fn(...args), this.t);
  }

  async ensureSnapshot() {
    const current = this.store.getSnapshot().snapshot;
    if (current?.providers) return current;
    if (this.snapshotPromise) return this.snapshotPromise;
    this.setState({ status: "loading", error: null });
    this.snapshotPromise = this.call("snapshot")
      .then((value) => {
        const snapshot = this.applyValue(value);
        this.setState({ status: "ready", error: null });
        return snapshot;
      })
      .catch((error) => {
        this.setState({ status: "error", error: errorText(error, this.t) });
        throw error;
      })
      .finally(() => {
        this.snapshotPromise = null;
      });
    return this.snapshotPromise;
  }

  async ensure(providerId) {
    const current = await this.ensureSnapshot();
    return providerId ? providerFromSnapshot(current, providerId) ?? current : current;
  }

  async refresh(providerId) {
    const existing = this.refreshPromises.get(providerId);
    if (existing) return existing;

    const promise = (async () => {
      this.setState({ action: "refresh", status: "loading", providerId, error: null, message: null });
      try {
        const value = await this.call("refresh", { providerId });
        const result = this.applyValue(value, providerId);
        this.setState({ message: refreshResultMessage(result, this.t) });
        return result;
      } catch (error) {
        this.setState({ action: null, status: "error", providerId, error: errorText(error, this.t) });
        return null;
      }
    })();
    this.refreshPromises.set(providerId, promise);
    try {
      return await promise;
    } finally {
      if (this.refreshPromises.get(providerId) === promise) this.refreshPromises.delete(providerId);
    }
  }

  async refreshAll() {
    const existing = this.refreshPromises.get("*");
    if (existing) return existing;

    const promise = (async () => {
      this.setState({ action: "refresh", status: "loading", providerId: null, error: null, message: null });
      try {
        const value = await this.call("refresh", {});
        const result = this.applyValue(value);
        this.setState({ message: refreshResultMessage(result, this.t) });
        return result;
      } catch (error) {
        this.setState({ action: null, status: "error", providerId: null, error: errorText(error, this.t) });
        return null;
      }
    })();
    this.refreshPromises.set("*", promise);
    try {
      return await promise;
    } finally {
      if (this.refreshPromises.get("*") === promise) this.refreshPromises.delete("*");
    }
  }

  async scan(providerId) {
    this.setState({ action: "scan", status: "loading", providerId, error: null, message: null });
    try {
      const value = await this.call("scan", { providerId });
      const result = this.applyValue(value, providerId);
      this.setState({ scan: result, action: null, status: "ready" });
      return result;
    } catch (error) {
      this.setState({ action: null, status: "error", providerId, error: errorText(error, this.t) });
      return null;
    }
  }

  async refreshDiscovery(providerId) {
    try {
      const value = await this.call("scan", { providerId });
      return { result: this.applyValue(value, providerId, { preserveControl: true }), error: null };
    } catch (error) {
      return { result: null, error: errorText(error, this.t) };
    }
  }

  async add(providerId, candidateId) {
    this.setState({ action: "add", status: "loading", providerId, error: null, message: null });
    try {
      const value = await this.call("add", { providerId, ...(candidateId ? { candidateId } : {}) });
      const result = this.applyValue(value, providerId);
      const count = result?.accounts?.length ?? 0;
      const discovery = await this.refreshDiscovery(providerId);
      const scanNotice = discovery.error
        ? text(this.t, "status.discoveryRefreshFailed", { error: discovery.error })
        : null;
      this.setState({ message: scanNotice ?? (count
        ? text(this.t, "status.accountAdded", { count })
        : text(this.t, "status.noNewOAuthCandidates")) });
      return result;
    } catch (error) {
      this.setState({ action: null, status: "error", providerId, error: errorText(error, this.t) });
      return null;
    }
  }

  async login(providerId) {
    const current = this.store.getSnapshot();
    if (current.auth?.providerId === providerId
      && ["pending", "processing"].includes(current.auth.status)
      && current.auth.sessionId) {
      this.scheduleAuth(providerId, current.auth.sessionId);
      this.setState({ action: null, status: "ready", error: null, message: text(this.t, "status.oauthInProgress") });
      return current.auth;
    }
    this.setState({ action: "login", status: "loading", providerId, error: null, message: null });
    // Antigravity's official `agy` CLI owns its browser window. Do not create
    // a placeholder tab for that provider; otherwise the captured URL is
    // opened once by agy and once again by this WebView.
    const authWindow = providerId === "antigravity"
      ? null
      : typeof window !== "undefined" && typeof window.open === "function"
        ? window.open("about:blank", "dockyard-dsh-oauth", "popup")
        : null;
    try {
      if (authWindow) authWindow.opener = null;
    } catch {
      // Some host shells expose a read-only WindowProxy opener.
    }
    try {
      const value = await this.call("login", { providerId });
      const result = this.applyValue(value, providerId);
      if (result?.browserOpened) {
        authWindow?.close?.();
      } else if (result?.authorizationUrl) {
        if (authWindow && !authWindow.closed) authWindow.location.href = result.authorizationUrl;
        else if (typeof window !== "undefined") window.open(result.authorizationUrl, "dockyard-dsh-oauth", "popup");
      } else {
        authWindow?.close?.();
      }
      if (["pending", "processing"].includes(result?.status) && result.sessionId) {
        this.scheduleAuth(providerId, result.sessionId);
      }
      return result;
    } catch (error) {
      authWindow?.close?.();
      this.setState({ action: null, status: "error", providerId, error: errorText(error, this.t) });
      return null;
    }
  }

  async submitAuthorizationCode(providerId, sessionId, code) {
    this.setState({ action: "auth-code", status: "loading", providerId, error: null, message: null });
    try {
      const value = await this.call("submitAuthorizationCode", { providerId, sessionId, code });
      const result = this.applyValue(value, providerId);
      if (["pending", "processing"].includes(result?.status) && result.sessionId) {
        this.scheduleAuth(providerId, result.sessionId);
        this.setState({ message: text(this.t, "status.oauthCodeSubmitted") });
      }
      return result;
    } catch (error) {
      this.setState({ action: null, status: "error", providerId, error: errorText(error, this.t) });
      return null;
    }
  }

  scheduleAuth(providerId, sessionId) {
    if (this.authTimers.has(sessionId)) return;
    let attempts = 0;
    const tick = async () => {
      this.authTimers.delete(sessionId);
      if (++attempts > 180) return;
      try {
        const value = await this.call("poll", { providerId, sessionId });
        const result = this.applyValue(value, providerId);
        if (["pending", "processing"].includes(result?.status)) {
          const timer = setTimeout(tick, 1000);
          this.authTimers.set(sessionId, timer);
        }
      } catch (error) {
        this.setState({ action: null, status: "error", providerId, error: errorText(error, this.t) });
      }
    };
    this.authTimers.set(sessionId, setTimeout(tick, 1000));
  }

  async cancelAuthorization(providerId, sessionId) {
    const timer = this.authTimers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.authTimers.delete(sessionId);
    this.setState({ action: "cancel", status: "loading", providerId, error: null, message: null });
    try {
      const value = await this.call("cancel", { providerId, sessionId });
      this.applyValue(value, providerId);
      this.setState({ auth: null, action: null, status: "ready", message: text(this.t, "status.oauthCancelled") });
      return value;
    } catch (error) {
      this.setState({ action: null, status: "error", providerId, error: errorText(error, this.t) });
      return null;
    }
  }

  async selectAccount(providerId, accountId) {
    this.setState({ action: "use", status: "loading", providerId, error: null, message: null });
    try {
      const value = await this.call("setPolicy", { providerId, policy: "manual", defaultAccountId: accountId });
      this.applyValue(value, providerId);
      this.setState({ message: text(this.t, "status.accountSelected") });
      return value;
    } catch (error) {
      this.setState({ action: null, status: "error", providerId, error: errorText(error, this.t) });
      return null;
    }
  }

  async removeAccount(providerId, accountId) {
    this.setState({ action: "remove", status: "loading", providerId, error: null, message: null });
    try {
      const value = await this.call("removeAccount", { providerId, accountId });
      const result = this.applyValue(value, providerId);
      const diagnostics = result?.diagnostics?.length ? ` (${result.diagnostics.join("; ")})` : "";
      const discovery = await this.refreshDiscovery(providerId);
      const scanNotice = discovery.error
        ? text(this.t, "status.discoveryRefreshFailed", { error: discovery.error })
        : "";
      const provider = providerFromSnapshot(this.store.getSnapshot().snapshot, providerId);
      const supportsOAuthLogin = provider?.manifest?.capabilities?.includes("oauth_authorization");
      const reentry = supportsOAuthLogin
        ? text(this.t, "status.reentryOAuth")
        : text(this.t, "status.reentryScan");
      this.setState({ auth: null, message: text(this.t, "status.accountRemoved", {
        details: diagnostics,
        scanNotice: scanNotice ? `; ${scanNotice}` : "",
        reentry,
      }) });
      return value;
    } catch (error) {
      this.setState({ action: null, status: "error", providerId, error: errorText(error, this.t) });
      return null;
    }
  }

  async setPolicy(providerId, policy) {
    this.setState({ action: "policy", status: "loading", providerId, error: null, message: null });
    try {
      const value = await this.call("setPolicy", { providerId, policy });
      this.applyValue(value, providerId);
      this.setState({ message: text(this.t, "status.policyUpdated", { policy: policyLabel(this.t, policy) }) });
      return value;
    } catch (error) {
      this.setState({ action: null, status: "error", providerId, error: errorText(error, this.t) });
      return null;
    }
  }

  dispose() {
    for (const timer of this.authTimers.values()) clearTimeout(timer);
    this.authTimers.clear();
  }
}

function modelDetails(directoryState, providerId = null) {
  const selected = directoryState?.current ?? null;
  const targetProviderId = providerId ?? selected?.provider ?? null;
  const group = targetProviderId
    ? directoryState?.groups?.find((entry) => entry.id === targetProviderId) ?? null
    : null;
  // A provider popup can be opened from the subscription overview while the
  // chat is still using another provider. Never leak that other provider's
  // model, context, or effort tiers into this popup.
  const current = selected && (!providerId || selected.provider === providerId) ? selected : null;
  if (!current) return { current: null, group, model: null, efforts: [] };
  const model = group?.models?.find((entry) => entry.id === current.model) ?? null;
  const efforts = model?.reasoning?.efforts ?? [];
  return { current, group, model, efforts };
}

function ChevronIcon({ open }) {
  return h("span", {
    className: "dockyard-dsh-chevron",
    "data-open": Boolean(open),
    "aria-hidden": true,
  }, h("svg", {
    viewBox: "0 0 14 14",
    focusable: "false",
    "aria-hidden": true,
  }, h("path", {
    d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
    fill: "currentColor",
  })));
}

function quotaView(account, t) {
  const rows = quotaRowsForAccount(account, t);
  if (rows.length === 0) {
    const diagnostic = account?.resources?.quotaDiagnostic ?? text(t, "quota.noWindow");
    const quotaUrl = account?.resources?.quotaUrl;
    return h("div", { className: "dockyard-dsh-muted" },
      diagnostic,
      quotaUrl
        ? h("span", null, " · ", h("a", {
          href: quotaUrl,
          target: "_blank",
          rel: "noreferrer noopener",
        }, text(t, "quota.openUsage")))
        : null,
    );
  }
  return h("div", { className: "dockyard-dsh-quota" }, rows.map((window, index) => {
    const percent = quotaPercent(window);
    const value = window.limit === null || window.limit === undefined
      ? formatNumber(window.remaining, t)
      : `${formatNumber(window.remaining, t)} / ${formatNumber(window.limit, t)}`;
    const unit = window.unit ? ` ${window.unit}` : "";
    return h("div", { key: `${window.id ?? "quota"}-${index}` },
      h("div", { className: "dockyard-dsh-quota-row" },
        h("span", { className: "dockyard-dsh-quota-copy" }, `${window.name ?? window.id ?? text(t, "value.quota")}${unit}`),
        h("span", { className: "dockyard-dsh-quota-value" }, percent === null ? value : `${percent}%`)),
      percent === null ? null : h("div", { className: "dockyard-dsh-quota-track" },
        h("div", { className: "dockyard-dsh-quota-fill", style: { width: `${percent}%` } })),
      h("div", { className: "dockyard-dsh-muted" }, text(t, "quota.resetUpdated", {
        reset: formatDate(window.resetAt, t),
        updated: formatDate(window.updatedAt, t),
      })));
  }));
}

function AccountCard({ account, current, providerId, controller, busy, t }) {
  const health = account?.health?.status;
  return h("div", { className: "dockyard-dsh-account", "data-current": current },
    h("div", { className: "dockyard-dsh-account-head" },
      h("div", { className: "dockyard-dsh-account-identity" },
        h("div", { className: "dockyard-dsh-account-name" }, accountName(account, t)),
        h("div", { className: "dockyard-dsh-account-id" }, accountIdentityLine(account, t))),
      h("div", { className: "dockyard-dsh-account-actions" },
        h("button", {
          type: "button",
          className: "dockyard-dsh-account-use",
          disabled: busy || current,
          onClick: () => controller.selectAccount(providerId, account.accountId),
        }, current ? text(t, "account.current") : text(t, "account.manualUse")),
        h("button", {
          type: "button",
          className: "dockyard-dsh-account-remove",
          disabled: busy,
          onClick: () => {
            if (typeof window !== "undefined" && !window.confirm(text(t, "account.confirmRemove", { account: accountName(account, t) }))) return;
            controller.removeAccount(providerId, account.accountId);
          },
        }, text(t, "account.remove")))),
    h("div", { className: "dockyard-dsh-account-meta" },
      h("span", { className: "dockyard-dsh-health", "data-bad": ["degraded", "cooldown", "expired", "exhausted"].includes(health) }, `${healthLabel(health, t)} · ${account.subscription?.plan ?? text(t, "account.planMissing")}`),
      account.refresh?.nextRefreshAt ? h("span", null, `OAuth: ${formatDate(account.refresh.nextRefreshAt, t)}`) : null),
    account.resources?.identityNote ? h("div", { className: "dockyard-dsh-account-note" }, account.resources.identityNote) : null,
    account.health?.lastError ? h("div", { className: "dockyard-dsh-account-error", title: account.health.lastError }, account.health.lastError) : null,
    quotaView(account, t));
}

function candidateMatchesAccount(candidate, account) {
  if (!candidate || !account) return false;
  if (candidate.accountId && account.accountId) return candidate.accountId === account.accountId;
  const candidateEmail = typeof candidate.email === "string" ? candidate.email.trim().toLowerCase() : "";
  const accountEmail = typeof account.email === "string" ? account.email.trim().toLowerCase() : "";
  return Boolean(candidateEmail && accountEmail && candidateEmail === accountEmail);
}

function CandidateList({ scan, providerId, controller, busy, accounts = [], t }) {
  const provider = scan?.providers?.find((entry) => entry.providerId === providerId);
  const candidates = provider?.candidates ?? [];
  const availableCandidates = candidates.filter((candidate) => (
    !candidate.imported && !accounts.some((account) => candidateMatchesAccount(candidate, account))
  ));
  if (availableCandidates.length === 0) {
    return h("div", { className: "dockyard-dsh-muted" }, provider?.diagnostics?.join("；") ?? text(t, "candidate.noNew"));
  }
  return h("div", { className: "dockyard-dsh-candidates" }, availableCandidates.map((candidate) => h("div", {
    className: "dockyard-dsh-candidate",
    key: candidate.candidateId,
  },
    h("span", { className: "dockyard-dsh-candidate-copy" }, candidate.email ?? candidate.displayName ?? candidate.candidateId),
    h("button", {
      type: "button",
      className: "dockyard-dsh-action",
      disabled: busy,
      onClick: () => controller.add(providerId, candidate.candidateId),
    }, text(t, "candidate.add")))));
}

function AuthorizationCodeLoginGuide({ auth, providerId, controller, busy, t }) {
  const [code, setCode] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (!code.trim() || busy || !auth?.sessionId) return;
    const result = await controller.submitAuthorizationCode(providerId, auth.sessionId, code);
    if (result) setCode("");
  };
  const providerLabel = providerId === "antigravity" ? "Antigravity" : text(t, "auth.providerSubscription");
  return h("div", { className: "dockyard-dsh-login-guide" },
    h("div", { className: "dockyard-dsh-login-guide-title" }, text(t, "auth.browserTitle", { provider: providerLabel })),
    h("div", { className: "dockyard-dsh-login-guide-copy" }, text(t, "auth.intro")),
    h("ol", { className: "dockyard-dsh-login-guide-steps" },
      h("li", { className: "dockyard-dsh-login-guide-step" },
        h("span", { className: "dockyard-dsh-login-guide-number" }, "1"),
        h("span", null, text(t, "auth.step1"))),
      h("li", { className: "dockyard-dsh-login-guide-step" },
        h("span", { className: "dockyard-dsh-login-guide-number" }, "2"),
        h("span", null, text(t, "auth.step2"))),
      h("li", { className: "dockyard-dsh-login-guide-step" },
        h("span", { className: "dockyard-dsh-login-guide-number" }, "3"),
        h("span", null, text(t, "auth.step3")))),
    h("form", { className: "dockyard-dsh-login-guide-code", onSubmit: submit },
      h("input", {
        value: code,
        disabled: busy,
        onChange: (event) => setCode(event.target.value),
        placeholder: text(t, "auth.callbackPlaceholder"),
        "aria-label": text(t, "auth.callbackAria"),
      }),
      h("button", { type: "submit", className: "dockyard-dsh-action", disabled: busy || !code.trim() }, text(t, "auth.submit"))),
    auth?.authorizationUrl && typeof window !== "undefined"
      ? h("button", { type: "button", className: "dockyard-dsh-action", onClick: () => window.open(auth.authorizationUrl, "_blank", "noopener,noreferrer") }, text(t, "auth.reopen"))
      : null,
    auth?.sessionId && ["pending", "processing"].includes(auth.status)
      ? h("button", {
        type: "button",
        className: "dockyard-dsh-action dockyard-dsh-action-danger",
        disabled: busy,
        onClick: () => controller.cancelAuthorization(providerId, auth.sessionId),
      }, busy ? text(t, "status.canceling") : text(t, "auth.cancel"))
      : null,
    auth?.diagnostic ? h("div", { className: "dockyard-dsh-login-guide-error" }, auth.diagnostic) : null);
}

function nativeQuotaView(native, t) {
  const usage = native?.usage ?? native?.entry?.usage ?? null;
  if (usage?.status === "unsupported") {
    return h("div", { className: "dockyard-dsh-muted" }, usage.message ?? text(t, "quota.noWindow"));
  }
  if (usage?.status === "error") {
    return h("div", { className: "dockyard-dsh-muted", "data-error": true }, text(t, "quota.readFailed", { error: usage.message ?? text(t, "error.unknown") }));
  }
  if (usage?.status === "unconfigured") {
    return h("div", { className: "dockyard-dsh-muted" }, usage.message ?? text(t, "quota.keyUnconfigured"));
  }
  const quota = native?.quota ?? native?.entry?.quota ?? null;
  if (quota) return quotaView({ quota }, t);
  return h("div", { className: "dockyard-dsh-muted" }, text(t, "quota.currentNoWindow"));
}

/** Collapsible section used for low-frequency blocks inside popups. */
function Fold({ title, value = null, open = false, children }) {
  return h("details", { className: "dockyard-dsh-fold", open },
    h("summary", null,
      h("span", null, title),
      value ? h("span", { className: "dockyard-dsh-section-value" }, value) : null),
    h("div", { className: "dockyard-dsh-fold-body" }, children));
}

function NativeKeyCard({ entry, providerId, controller, busy, t, open = false, onToggle = null }) {
  const configured = entry?.configured === true;
  const current = entry?.active === true;
  const writable = entry?.credential?.writable !== false;
  const label = entry?.label ?? entry?.ref ?? text(t, "title.key");
  const toggle = () => (typeof onToggle === "function" ? onToggle(entry.ref) : null);
  return h("div", { className: "dockyard-dsh-keyrow", "data-current": current, "data-open": open },
    h("button", {
      type: "button",
      className: "dockyard-dsh-keyrow-head",
      "aria-expanded": Boolean(open),
      title: entry?.ref ?? "",
      onClick: toggle,
    },
      h("span", { className: "dockyard-dsh-keyrow-identity" },
        h("span", { className: "dockyard-dsh-keyrow-name" }, label),
        h("span", { className: "dockyard-dsh-keyrow-ref" }, shortRef(entry?.ref))),
      h("span", { className: "dockyard-dsh-keyrow-state", "data-bad": !configured },
        configured ? text(t, "native.configured") : text(t, "native.unconfigured")),
      h("span", { className: "dockyard-dsh-keyrow-chevron", "data-open": Boolean(open), "aria-hidden": "true" }, "▾")),
    open ? h("div", { className: "dockyard-dsh-keyrow-detail" },
      h("div", { className: "dockyard-dsh-keyrow-detail-actions" },
        h("button", {
          type: "button",
          className: "dockyard-dsh-account-use",
          disabled: busy || current || !configured,
          onClick: () => controller.selectKey(providerId, entry.ref),
        }, current ? text(t, "native.currentKey") : text(t, "native.manualUse")),
        h("button", {
          type: "button",
          className: "dockyard-dsh-account-remove",
          disabled: busy,
          title: writable ? text(t, "native.removeTitle") : text(t, "native.unlinkTitle"),
          onClick: () => {
            const action = writable ? text(t, "native.removeTitle") : text(t, "native.unlinkTitle");
            if (typeof window !== "undefined" && !window.confirm(text(t, "native.removeConfirm", { action, label }))) return;
            controller.removeKey(providerId, entry.ref);
          },
        }, writable ? text(t, "native.remove") : text(t, "native.unlinkReference")),
        h("span", { className: "spacer" }),
        entry?.credential?.source ? h("span", { className: "dockyard-dsh-key-source" }, text(t, "native.source", { source: entry.credential.source })) : null,
        entry?.implicit ? h("span", { className: "dockyard-dsh-key-source" }, text(t, "native.fromProviderConfig")) : null),
      entry?.usage ? nativeQuotaView(entry, t) : null) : null);
}

function NativeKeyPopup({ providerId, native, directory, directoryState, nativeController, onClose, t, size = "normal" }) {
  const [tierBusy, setTierBusy] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [labelDraft, setLabelDraft] = useState("");
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [expandedRef, setExpandedRef] = useState(null);
  const { current, group, model, efforts } = modelDetails(directoryState, providerId);
  const modelLabel = model?.name ?? current?.model ?? text(t, "title.noModel");
  const compactModelId = displayModelId(providerId, current?.model);
  const tier = current?.reasoningEffort ?? model?.reasoning?.defaultEffort ?? null;
  const busy = native.action !== null;
  const keys = native.keys ?? [];
  const configuredCount = keys.filter((entry) => entry.configured).length;

  const chooseTier = async (value) => {
    if (!current || !directory || tierBusy) return;
    setTierBusy(true);
    try {
      await directory.select({ ...current, reasoningEffort: value });
    } finally {
      setTierBusy(false);
    }
  };

  const addKey = async () => {
    if (!keyDraft.trim() || busy) return;
    const added = await nativeController.addKey(providerId, keyDraft, labelDraft);
    if (added) {
      setKeyDraft("");
      setLabelDraft("");
    }
  };

  const title = native.entry?.displayName ?? group?.name ?? providerId;
  return h("div", {
    className: "dockyard-dsh-popup",
    "data-size": size,
    role: "dialog",
    "aria-label": text(t, "native.keyAria", { title }),
    onMouseDown: (event) => event.stopPropagation(),
  },
    h("div", { className: "dockyard-dsh-head" },
      h("div", { className: "dockyard-dsh-head-copy" },
        h("div", { className: "dockyard-dsh-eyebrow" }, text(t, "eyebrow.keyProvider")),
        h("div", { className: "dockyard-dsh-title" }, title),
        h("div", { className: "dockyard-dsh-model", title: current?.model }, `${modelLabel}${compactModelId && modelLabel !== current.model && modelLabel !== compactModelId ? ` · ${compactModelId}` : ""}`),
        model?.description ? h("div", { className: "dockyard-dsh-model-context" }, model.description) : null),
      h("button", { type: "button", className: "dockyard-dsh-close", onClick: onClose, "aria-label": text(t, "ui.close") }, "×")),
    h("div", {
      className: "dockyard-dsh-status",
      "data-error": Boolean(native.error),
      "data-success": Boolean(native.message && !native.error),
      role: native.error ? "alert" : "status",
    }, h("span", { className: "dockyard-dsh-status-copy" }, native.error ?? native.message ?? (native.status === "loading"
      ? text(t, "status.readingNative")
      : text(t, "status.nativeSource")))),
    h("div", { className: "dockyard-dsh-popup-scroll" },
      h("div", { className: "dockyard-dsh-toolbar" },
        h("button", { type: "button", className: "dockyard-dsh-action dockyard-dsh-action-primary", disabled: busy, onClick: () => setShowKeyForm((value) => !value) },
          showKeyForm ? text(t, "native.addKeyHide") : text(t, "native.addKeyShow")),
        h("button", { type: "button", className: "dockyard-dsh-action", disabled: busy, onClick: () => nativeController.refresh(providerId) }, native.action === "refresh" ? text(t, "status.refreshing") : text(t, "native.refresh"))),
      showKeyForm ? h("div", { className: "dockyard-dsh-key-form" },
        h("div", { className: "dockyard-dsh-section-title" }, h("span", null, text(t, "native.addKeyTitle")), h("span", { className: "dockyard-dsh-section-value" }, text(t, "native.credentialsWrite"))),
        h("div", { className: "dockyard-dsh-key-form-row" },
          h("input", {
            className: "dockyard-dsh-key-input",
            type: "password",
            value: keyDraft,
            placeholder: text(t, "native.pasteApiKey"),
            autoComplete: "off",
            onChange: (event) => setKeyDraft(event.target.value),
          }),
          h("button", { type: "button", className: "dockyard-dsh-key-save", disabled: busy || !keyDraft.trim(), onClick: addKey }, native.action === "add" ? text(t, "native.saving") : text(t, "native.save"))),
        h("input", {
          className: "dockyard-dsh-key-input",
          type: "text",
          value: labelDraft,
          placeholder: text(t, "native.optionalName"),
          onChange: (event) => setLabelDraft(event.target.value),
        })) : null,
      h("div", { className: "dockyard-dsh-key-notice" }, native.runtimeMode === "request-key-pool"
        ? text(t, "native.notice.requestPool")
        : text(t, "native.notice.manual")),
      h("div", { className: "dockyard-dsh-field" },
        h("span", { className: "dockyard-dsh-field-label" }, text(t, "native.keyStrategy")),
        h("select", {
          className: "dockyard-dsh-select",
          value: native.policy ?? "manual",
          disabled: busy,
          onChange: (event) => { void nativeController.setPolicy(providerId, event.target.value); },
        },
          h("option", { value: "manual" }, text(t, "nativePolicy.manual")),
          h("option", { value: "round_robin", disabled: native.runtimeMode !== "request-key-pool" }, text(t, "nativePolicy.round_robin")),
          h("option", { value: "failover", disabled: native.runtimeMode !== "request-key-pool" }, text(t, "nativePolicy.failover")))),
      h("div", { className: "dockyard-dsh-section" },
        h("div", { className: "dockyard-dsh-section-title" }, h("span", null, text(t, "native.configuredKeys")), h("span", { className: "dockyard-dsh-section-value" }, text(t, "native.keyCountSummary", { configured: configuredCount, total: keys.length }))),
        keys.length === 0
          ? h("div", { className: "dockyard-dsh-muted" }, text(t, "native.noKeys"))
          : h("div", { className: "dockyard-dsh-keytable" }, keys.map((entry) => h(NativeKeyCard, {
            t,
            key: entry.ref,
            entry,
            providerId,
            controller: nativeController,
            busy,
            open: expandedRef === entry.ref,
            onToggle: (ref) => setExpandedRef((previous) => (previous === ref ? null : ref)),
          })))),
      efforts.length > 0 ? h(Fold, { title: text(t, "native.currentModelTier"), value: text(t, "subscription.liveCatalog") },
        h("div", { className: "dockyard-dsh-tier-list" }, efforts.map((effort) => h("button", {
          type: "button",
          className: "dockyard-dsh-tier",
          "data-active": tier === effort.id,
          disabled: tierBusy,
          key: effort.id,
          title: effort.description ?? effort.id,
          onClick: () => chooseTier(effort.id),
        }, effort.name ?? effort.id)))) : null,
      h(Fold, { title: text(t, "native.quotaWindow"), value: text(t, "native.providerRealtime") },
        nativeQuotaView(native, t))));
}

function SubscriptionOverviewPopup({ providers, directoryState, controlState, controller, selectedProviderId, onSelect, onClose, t }) {
  const busy = controlState.action !== null;
  return h("div", {
    className: "dockyard-dsh-popup",
    role: "dialog",
    "aria-label": text(t, "subscription.aria"),
    onMouseDown: (event) => event.stopPropagation(),
  },
    h("div", { className: "dockyard-dsh-head" },
      h("div", { className: "dockyard-dsh-head-copy" },
        h("div", { className: "dockyard-dsh-eyebrow" }, text(t, "eyebrow.subscriptions")),
        h("div", { className: "dockyard-dsh-title" }, text(t, "title.subscriptionManagement")),
        h("div", { className: "dockyard-dsh-model" }, text(t, "subtitle.subscriptionManagement"))),
      h("button", { type: "button", className: "dockyard-dsh-close", onClick: onClose, "aria-label": text(t, "ui.close") }, "×")),
    h("div", {
      className: "dockyard-dsh-status",
      "data-error": Boolean(controlState.error),
      "data-success": Boolean(controlState.message && !controlState.error),
      role: controlState.error ? "alert" : "status",
    },
      h("span", { className: "dockyard-dsh-status-copy" }, controlState.error ?? controlState.message ?? (controlState.status === "loading"
        ? text(t, "status.readingSubscriptions")
        : text(t, "status.subscriptionReady")))),
    h("div", { className: "dockyard-dsh-popup-scroll" },
      h("div", { className: "dockyard-dsh-toolbar" },
        h("button", {
          type: "button",
          className: "dockyard-dsh-action dockyard-dsh-action-primary",
          disabled: busy,
          onClick: () => controller.refreshAll(),
        }, controlState.action === "refresh" ? text(t, "status.refreshing") : text(t, "subscription.refreshAll"))),
      h("div", { className: "dockyard-dsh-section" },
        h("div", { className: "dockyard-dsh-section-title" },
          h("span", null, text(t, "subscription.providers")),
          h("span", { className: "dockyard-dsh-section-value" }, text(t, "subscription.providerCount", { count: providers.length }))),
        providers.length === 0
          ? h("div", { className: "dockyard-dsh-muted" }, text(t, "subscription.none"))
          : h("div", { className: "dockyard-dsh-provider-list" }, providers.map((provider) => {
            const providerId = provider.providerId;
            const group = directoryState?.groups?.find((entry) => entry.id === providerId);
            const modelCount = Array.isArray(group?.models)
              ? text(t, "subscription.modelCount", { count: group.models.length })
              : text(t, "subscription.modelPending");
            const displayName = providerDisplayName(providerId, provider.manifest, t);
            return h("button", {
              type: "button",
              className: "dockyard-dsh-provider-row",
              "data-current": providerId === selectedProviderId,
              key: providerId,
              onClick: () => onSelect(providerId),
              "aria-label": text(t, "subscription.configure", { provider: displayName }),
            },
              h("span", { className: "dockyard-dsh-provider-row-copy" },
                h("span", { className: "dockyard-dsh-provider-row-name" }, displayName),
                h("span", { className: "dockyard-dsh-provider-row-meta" }, `${providerOverviewSummary(provider, t)} · ${modelCount}`)),
              h("span", { className: "dockyard-dsh-provider-row-arrow", "aria-hidden": true }, "›"));
          })))));
}

function DockyardPopup({ providerId, provider, directory, directoryState, controlState, controller, onOpenOverview, onClose, t, size = "normal" }) {
  const [tierBusy, setTierBusy] = useState(false);
  const { current, group, model, efforts } = modelDetails(directoryState, providerId);
  const modelLabel = model?.name ?? current?.model ?? text(t, "title.noModel");
  const compactModelId = displayModelId(providerId, current?.model);
  const tier = current?.reasoningEffort ?? model?.reasoning?.defaultEffort ?? null;
  const accounts = provider?.accounts ?? [];
  const activeId = provider?.defaultAccountId ?? null;
  const busy = controlState.action !== null;
  const authInProgress = controlState.auth?.providerId === providerId
    && ["pending", "processing"].includes(controlState.auth?.status)
    && Boolean(controlState.auth?.sessionId);
  const needsReauthorization = accounts.some((account) => account?.health?.status === "expired");
  const supportsOAuthLogin = provider?.manifest?.capabilities?.includes("oauth_authorization");

  const chooseTier = async (value) => {
    if (!current || !directory || tierBusy) return;
    setTierBusy(true);
    try {
      await directory.select({ ...current, reasoningEffort: value });
    } finally {
      setTierBusy(false);
    }
  };

  return h("div", {
    className: "dockyard-dsh-popup",
    "data-size": size,
    role: "dialog",
    "aria-label": `${providerDisplayName(providerId, provider?.manifest, t)} ${text(t, "trigger.accountQuota")}`,
    onMouseDown: (event) => event.stopPropagation(),
  },
    h("div", { className: "dockyard-dsh-head" },
      h("div", { className: "dockyard-dsh-head-copy" },
        h("div", { className: "dockyard-dsh-eyebrow" }, text(t, "eyebrow.subscription")),
        h("div", { className: "dockyard-dsh-title" }, providerDisplayName(providerId, provider?.manifest, t) || group?.name),
        h("div", { className: "dockyard-dsh-model", title: current?.model }, `${modelLabel}${compactModelId && modelLabel !== current.model && modelLabel !== compactModelId ? ` · ${compactModelId}` : ""}`),
        model?.description ? h("div", { className: "dockyard-dsh-model-context" }, model.description) : null),
      h("button", { type: "button", className: "dockyard-dsh-close", onClick: onClose, "aria-label": text(t, "ui.close") }, "×")),
    h("div", {
      className: "dockyard-dsh-status",
      "data-error": Boolean(controlState.error),
      "data-success": Boolean(controlState.message && !controlState.error),
      role: controlState.error ? "alert" : "status",
    },
      h("span", { className: "dockyard-dsh-status-copy" }, controlState.error ?? controlState.message ?? (controlState.status === "loading"
        ? text(t, "status.readingProvider")
        : text(t, "status.providerOAuthQuota")))),
    h("div", { className: "dockyard-dsh-popup-scroll" },
      providerId === "antigravity" ? h("div", { className: "dockyard-dsh-account-note" }, text(t, "subscription.antigravityNote")) : null,
      h("div", { className: "dockyard-dsh-toolbar" },
        h("button", { type: "button", className: "dockyard-dsh-action", disabled: busy, onClick: onOpenOverview }, text(t, "subscription.all")),
        h("button", { type: "button", className: "dockyard-dsh-action dockyard-dsh-action-primary", disabled: busy, onClick: () => controller.refresh(providerId) }, controlState.action === "refresh" ? text(t, "status.refreshing") : text(t, "native.refresh")),
        h("button", { type: "button", className: "dockyard-dsh-action", disabled: busy || authInProgress, onClick: () => controller.login(providerId) }, controlState.action === "login"
          ? (supportsOAuthLogin ? text(t, "status.waitingVerification") : text(t, "status.readingInstructions"))
          : authInProgress ? text(t, "status.verificationInProgress")
            : needsReauthorization && supportsOAuthLogin ? text(t, "auth.reauthorize")
              : supportsOAuthLogin ? text(t, "auth.loginAdd") : text(t, "auth.officialInstructions")),
        h("button", { type: "button", className: "dockyard-dsh-action", disabled: busy, onClick: () => controller.scan(providerId) }, controlState.action === "scan" ? text(t, "status.scanning") : text(t, "auth.scanLocal"))),
      controlState.auth?.providerId === providerId
        ? controlState.auth.authorizationCodeRequired || providerId === "antigravity"
          ? h(AuthorizationCodeLoginGuide, { auth: controlState.auth, providerId, controller, busy, t })
          : h("div", { className: "dockyard-dsh-status dockyard-dsh-auth-status" },
            h("span", { className: "dockyard-dsh-status-copy" }, `${controlState.auth.status}${controlState.auth.instructions ? ` · ${controlState.auth.instructions}` : ""}`),
            controlState.auth.authorizationUrl && typeof window !== "undefined" ? h("button", { type: "button", className: "dockyard-dsh-action", title: text(t, "auth.openPage"), onClick: () => window.open(controlState.auth.authorizationUrl, "_blank", "noopener,noreferrer") }, text(t, "auth.authorize")) : null,
            controlState.auth.diagnostic ? h("span", { className: "dockyard-dsh-status-copy dockyard-dsh-auth-diagnostic" }, controlState.auth.diagnostic) : null)
        : null,
      h("div", { className: "dockyard-dsh-field" },
        h("span", { className: "dockyard-dsh-field-label" }, text(t, "subscription.accountStrategy")),
        h("select", {
          className: "dockyard-dsh-select",
          value: provider?.policy ?? "round_robin",
          disabled: busy,
          onChange: (event) => controller.setPolicy(providerId, event.target.value),
        }, Object.keys(POLICY_KEYS).map((value) => h("option", { value, key: value }, policyLabel(t, value))))),
      efforts.length > 0 ? h("div", { className: "dockyard-dsh-section" },
        h("div", { className: "dockyard-dsh-section-title" }, h("span", null, text(t, "native.currentModelTier")), h("span", { className: "dockyard-dsh-section-value" }, text(t, "subscription.liveCatalog"))),
        h("div", { className: "dockyard-dsh-tier-list" }, efforts.map((effort) => h("button", {
          type: "button",
          className: "dockyard-dsh-tier",
          "data-active": tier === effort.id,
          disabled: tierBusy,
          key: effort.id,
          title: effort.description ?? effort.id,
          onClick: () => chooseTier(effort.id),
        }, effort.name ?? effort.id)))) : null,
      h("div", { className: "dockyard-dsh-section" },
        h("div", { className: "dockyard-dsh-section-title" }, h("span", null, text(t, "subscription.connectedAccounts")), h("span", { className: "dockyard-dsh-section-value" }, `${accounts.length}`)),
        accounts.length === 0
          ? h("div", { className: "dockyard-dsh-muted" }, supportsOAuthLogin
            ? text(t, "subscription.noAccountsOAuth")
            : text(t, "subscription.noAccountsScan"))
          : accounts.map((account) => h(AccountCard, { t,
            key: account.accountId,
            account,
            current: account.accountId === activeId,

            providerId,
            controller,
            busy,
          }))),
      controlState.scan ? h("div", { className: "dockyard-dsh-section" },
        h("div", { className: "dockyard-dsh-section-title" }, h("span", null, text(t, "subscription.localCandidates"))),
        h(CandidateList, { scan: controlState.scan, providerId, controller, busy, accounts, t })) : null));
}

function DockyardAccountControl({ directory, modelDirectory, controller, nativeController, t }) {
  const directoryState = useSnapshot(directory);
  const controlState = useSnapshot(controller.store);
  const nativeState = useSnapshot(nativeController.store);
  const [open, setOpen] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [detailProviderId, setDetailProviderId] = useState(null);
  const rootRef = useRef(null);
  const accountSignatureRef = useRef(undefined);
  const modelSelectionSignatureRef = useRef(undefined);
  const { current, group, model } = modelDetails(directoryState);
  const currentProviderId = current?.provider ?? null;
  const modelSelectionSignature = JSON.stringify([
    current?.provider ?? null,
    current?.model ?? null,
  ]);
  const providers = controlState.snapshot?.providers ?? [];
  const currentProvider = providerFromSnapshot(controlState.snapshot, currentProviderId);
  const currentNative = nativeState.providerId === currentProviderId && nativeState.native ? nativeState : null;
  const currentNativeLoading = nativeState.providerId === currentProviderId
    && ["loading", "error"].includes(nativeState.status);
  const providerId = showOverview ? null : detailProviderId ?? currentProviderId;
  const provider = providerFromSnapshot(controlState.snapshot, providerId);
  // Providers absent from the OAuth/account snapshot are DSH-native Key
  // providers. Render their management surface immediately in a loading state
  // while the native settings request is in flight; falling back to the
  // subscription overview here made a model switch look like a stale
  // subscription state until the user clicked again.
  const snapshotReady = Array.isArray(controlState.snapshot?.providers);
  const nativeCandidate = Boolean(providerId && (
    nativeState.providerId === providerId
    || (snapshotReady && !provider)
  ));
  const native = nativeState.providerId === providerId && nativeState.native
    ? nativeState
    : nativeCandidate
      ? nativeState.providerId === providerId
        ? nativeState
        : {
          providerId,
          status: "loading",
          action: "refresh",
          entry: null,
          namespace: null,
          profile: null,
          settingsPath: [],
          apiKeyRef: null,
          keys: [],
          policy: "manual",
          native: false,
          runtimeMode: "request-key-pool",
          quota: null,
          usage: null,
          error: null,
          message: null,
        }
      : null;
  const accountSignature = connectedAccountSignature(controlState.snapshot);
  // Wide popup mode when the active provider manages several credentials —
  // the key/account table plus per-key usage details need the extra room.
  const managedRowCount = Math.max(
    Array.isArray(currentNative?.keys) ? currentNative.keys.length : 0,
    Array.isArray(provider?.accounts) ? provider.accounts.length : 0,
  );
  const popupSize = managedRowCount >= 3 ? "wide" : "normal";

  useEffect(() => {
    installStyles();
  }, []);

  useEffect(() => {
    const previous = modelSelectionSignatureRef.current;
    modelSelectionSignatureRef.current = modelSelectionSignature;
    if (previous === undefined || previous === modelSelectionSignature) return;

    // The account-control popup follows the selected model's provider. A
    // provider chosen from the overview is only a temporary detail view; once
    // the model changes, keeping that override would show the previous
    // subscription or API-Key popup until a full page reload.
    setShowOverview(false);
    setDetailProviderId(currentProviderId);
  }, [currentProviderId, modelSelectionSignature]);

  useEffect(() => {
    controller.ensureSnapshot().catch(() => {});
  }, [controller]);

  useEffect(() => {
    if (typeof modelDirectory?.load !== "function") return undefined;
    const previous = accountSignatureRef.current;
    accountSignatureRef.current = accountSignature;
    // DSH's native ModelDirectory may finish its initial load before the
    // restored account pool becomes visible after a computer restart. If the
    // first observed snapshot already has accounts, explicitly reload once so
    // optional providers are not left at "model catalog pending" forever.
    if (!accountSignature || (previous !== undefined && previous === accountSignature)) return undefined;
    const timer = setTimeout(() => {
      const loading = modelDirectory.load();
      loading?.catch?.(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, [accountSignature, modelDirectory]);

  useEffect(() => {
    if (!providerId) return undefined;
    controller.ensure(providerId).catch(() => {});
    nativeController.ensure(providerId).catch(() => {});
    return undefined;
  }, [controller, nativeController, providerId]);

  useEffect(() => {
    if (!providerId) return undefined;
    const hasProvider = Boolean(provider);
    if (hasProvider) {
      const needsIdentityScan = (provider.accounts ?? []).some((account) => !account.email);
      if (open && needsIdentityScan) {
        void controller.scan(providerId).then(() => controller.refresh(providerId));
      } else {
        void controller.refresh(providerId);
      }
      const timer = setInterval(() => controller.refresh(providerId), 30_000);
      return () => clearInterval(timer);
    }
    void nativeController.refresh(providerId);
    const timer = setInterval(() => nativeController.refresh(providerId), 30_000);
    return () => clearInterval(timer);
  }, [controller, nativeController, open, providerId, Boolean(provider)]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    // Wide mode (>=3 managed rows) gets a larger desired popup so the key
    // table and usage details fit without nested scrolling; positioning stays
    // viewport-clamped in both modes.
    const desiredWidth = popupSize === "wide" ? 720 : 480;
    const desiredMaxHeight = popupSize === "wide" ? 720 : 560;
    const updatePopupPosition = () => {
      const anchor = rootRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 14;
      const gap = 9;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popupWidth = Math.min(desiredWidth, Math.max(0, viewportWidth - margin * 2));
      const left = Math.min(
        Math.max(margin, rect.left),
        Math.max(margin, viewportWidth - popupWidth - margin),
      );
      const availableAbove = Math.max(0, rect.top - gap - margin);
      const availableBelow = Math.max(0, viewportHeight - rect.bottom - margin);
      const openAbove = availableAbove >= 280 || availableAbove >= availableBelow;

      anchor.style.setProperty("--dockyard-dsh-popup-left", `${left}px`);
      if (openAbove) {
        anchor.style.setProperty("--dockyard-dsh-popup-top", "auto");
        anchor.style.setProperty("--dockyard-dsh-popup-bottom", `${Math.max(margin, viewportHeight - rect.top + gap)}px`);
        anchor.style.setProperty("--dockyard-dsh-popup-max-height", `${Math.max(180, Math.min(desiredMaxHeight, availableAbove))}px`);
      } else {
        anchor.style.setProperty("--dockyard-dsh-popup-top", `${margin}px`);
        anchor.style.setProperty("--dockyard-dsh-popup-bottom", "auto");
        anchor.style.setProperty("--dockyard-dsh-popup-max-height", `${Math.max(180, Math.min(desiredMaxHeight, viewportHeight - margin * 2))}px`);
      }
    };
    updatePopupPosition();
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [open, providerId, showOverview, providers.length, popupSize]);

  const currentSelectedAccount = currentProvider?.defaultAccountId
    ? currentProvider.accounts?.find((account) => account.accountId === currentProvider.defaultAccountId)
    : currentProvider?.accounts?.length === 1 ? currentProvider.accounts[0] : null;
  const summary = currentProviderId && currentProvider
    ? currentProvider.accounts?.length > 1 && !currentProvider.defaultAccountId
      ? text(t, "summary.accountCount", { count: currentProvider.accounts.length })
      : quotaSummary(currentSelectedAccount, t)
    : currentProviderId && currentNative
      ? text(t, "summary.keyCount", { count: currentNative.keys?.filter((entry) => entry.configured).length ?? 0 })
    : currentProviderId && currentNativeLoading ? text(t, "status.reading") : "";
  const loading = controlState.action !== null || nativeState.action !== null || directoryState.status === "loading";
  const providerLabel = currentProviderId
    ? providerDisplayName(currentProviderId, currentProvider?.manifest ?? currentNative?.entry, t)
    : text(t, "trigger.subscriptionManagement");
  const modelLabel = model?.name ?? current?.model ?? "";

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      setShowOverview(false);
      setDetailProviderId(null);
      return;
    }
    // The subscription entry must not disappear just because a model is
    // selected. Open the provider detail when its account/key state is
    // already loaded; otherwise fall back to the overview so OAuth login and
    // subscription discovery remain reachable for every model selection.
    const hasManagedProvider = Boolean(currentProvider || currentNative || nativeCandidate);
    setShowOverview(!currentProviderId || !hasManagedProvider);
    setDetailProviderId(currentProviderId && hasManagedProvider ? currentProviderId : null);
    setOpen(true);
  };
  const openSubscriptionOverview = () => {
    setShowOverview(true);
    setDetailProviderId(null);
    setOpen(true);
  };
  const overviewOpen = open && (showOverview || !providerId || (!provider && !native));
  return h("div", { className: "dockyard-dsh-anchor", ref: rootRef },
    h("button", {
      type: "button",
      className: "dockyard-dsh-trigger",
      title: currentProviderId
         ? text(t, "trigger.providerModel", { provider: providerLabel, model: modelLabel })
         : text(t, "trigger.subscriptionManagement"),
      "aria-label": currentProviderId
        ? `${providerLabel} ${currentProvider ? text(t, "trigger.accountQuota") : text(t, "trigger.keyQuota")}`
        : text(t, "subscription.aria"),
      "aria-expanded": open,
      onClick: toggleOpen,
    },
      h("span", { className: "dockyard-dsh-dot", "data-live": Boolean(provider), "data-loading": loading }),
      h("span", { className: "dockyard-dsh-label" }, providerLabel),
      h("span", { className: "dockyard-dsh-summary" }, summary),
      h(ChevronIcon, { open })),
    h("button", {
      type: "button",
      className: "dockyard-dsh-add-trigger",
      title: text(t, "trigger.addTitle"),
      "aria-label": text(t, "subscription.addAria"),
      onClick: openSubscriptionOverview,
    }, text(t, "trigger.addSubscription")),
    overviewOpen ? h(SubscriptionOverviewPopup, {
      providers,
      directoryState,
      controlState,
      controller,
      selectedProviderId: currentProviderId,
       t,
      onSelect: (selectedProviderId) => {
        setShowOverview(false);
        setDetailProviderId(selectedProviderId);
      },
      onClose: () => {
        setShowOverview(false);
        setOpen(false);
      },
    }) : open && provider ? h(DockyardPopup, {
      providerId,
      provider,
      directory: modelDirectory,
      directoryState,
      controlState,
      controller,
      t,
      size: popupSize,
       onOpenOverview: openSubscriptionOverview,
      onClose: () => setOpen(false),
    }) : open && native ? h(NativeKeyPopup, { t,
      providerId,
      native,
      directory: modelDirectory,
      directoryState,
      nativeController,
      size: popupSize,
      onClose: () => setOpen(false),
    }) : null);
}

// `remote.dockyard` is created by this plugin's own `$mount` call below. It
// must not be a top-level dependency, otherwise Cordis waits for the service
// before running this plugin and the plugin can never create it.
export const inject = ["slots", "modelDirectories", "remote", "connection", "locale"];

/** Mount the provider-aware account control in the native DSH composer. */
export async function apply(ctx) {
  installStyles();
  const disposeModelMenuFolding = installModelMenuFolding();
  const disposeLocale = ctx.locale.register(DOCKYARD_LOCALE_NS, DOCKYARD_LOCALES);
  const t = ctx.locale.bind(DOCKYARD_LOCALE_NS);
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE);
  // Read the dynamically mounted namespace through the service registry. The
  // traceable `ctx.remote.dockyard` property requires a declared inject and
  // would reintroduce the self-dependency deadlock above.
  const remote = ctx.get("remote.dockyard");
  const controller = new DockyardClientController(remote, t);
  ctx.inject(["slots", "modelDirectories", "connection"], (scope) => {
    const connection = scope.connection ?? ctx.get("connection");
    const nativeController = new NativeKeyPoolController(connection?.api, remote, t);
    scope.slots.inject("conversation.input.left", () => scope.slots.register({
      name: "conversation.input.left",
      id: "dockyard-account-control",
      order: 10,
       locale: DOCKYARD_LOCALE_NS,
      inject: (sessionId) => {
        const modelDirectory = scope.modelDirectories.directoryFor(sessionId);
        return {
          directory: modelDirectory.store,
          modelDirectory,
          controller,
          nativeController,
        };
      },
    }, DockyardAccountControl));
  });
  return async () => {
    disposeModelMenuFolding();
    disposeLocale?.();
    controller.dispose();
    await disposeRemote?.();
  };
}
