/** 全部样式（随插件生命周期注入/移除）。类名统一 dsh-av-* 前缀。 */
export const STYLES = `
/* ── 会话里的头像 ── */
[data-chat-flow-kind="user"],[data-chat-flow-kind="steering"],[data-chat-flow-kind="assistant-step"]{position:relative}
/* 贴在该行「第一行」的左上 / 右上外侧 */
.dsh-av-aiavatar{position:absolute;top:0;right:calc(100% + 8px);display:flex;flex-direction:column;align-items:center;gap:2px;z-index:1}
.dsh-av-useravatar{position:absolute;top:0;left:calc(100% + 8px);display:flex;flex-direction:column;align-items:center;gap:2px;z-index:1}
.dsh-av-avatar{display:block;border-radius:50%;object-fit:cover;
  border:1px solid var(--dsw-alias-border-l1,#555);box-shadow:0 1px 3px rgba(0,0,0,.2)}
/* 方形＝按比例圆角（25% 与尺寸等比，16px 与 128px 观感一致；想更方改小、更圆改大） */
.dsh-av-avatar[data-shape="square"]{border-radius:25%}
@container (max-width:900px){
  .dsh-av-aiavatar{position:static;float:left;margin:2px 8px 4px 0}
  .dsh-av-useravatar{position:static;float:right;margin:2px 0 4px 8px}
}

/* ── 设置面板 ── */
.dsh-av-panel{display:flex;flex-direction:column;gap:14px;padding:4px 2px;font-size:13px;color:var(--dsw-alias-label-primary,#ddd)}
.dsh-av-card{border:1px solid var(--dsw-alias-border-l1,#555);border-radius:10px;padding:12px 14px;
  background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.02))}
.dsh-av-card-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.dsh-av-card-title{font-weight:600}
.dsh-av-card-hint{color:var(--dsw-alias-label-secondary,#999);font-size:12px;margin-top:2px}
.dsh-av-preview{margin-left:auto;width:44px;height:44px;border-radius:50%;object-fit:cover;
  border:1px solid var(--dsw-alias-border-l1,#555);background:var(--dsw-alias-bg-overlay,#222)}
.dsh-av-preview[data-shape="square"]{border-radius:25%}
.dsh-av-preview-empty{display:flex;align-items:center;justify-content:center;font-size:10px;border-style:dashed;
  color:var(--dsw-alias-label-tertiary,#888)}
.dsh-av-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;
  border-top:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.25))}
.dsh-av-row:first-of-type{border-top:none}
.dsh-av-label{color:var(--dsw-alias-label-primary,#ddd)}
.dsh-av-hint{color:var(--dsw-alias-label-secondary,#999);font-size:12px;margin-top:2px}
.dsh-av-group{display:flex;align-items:center;gap:8px}
.dsh-av-btn{display:inline-flex;align-items:center;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;
  border:1px solid var(--dsw-alias-border-l1,#555);background:var(--dsw-alias-bg-layer-1,#1e1e1e);
  color:var(--dsw-alias-label-primary,#ddd);white-space:nowrap}
.dsh-av-btn:hover{border-color:var(--dsw-alias-brand-primary,#4a9eff)}
.dsh-av-btn[disabled]{opacity:.5;cursor:not-allowed}
.dsh-av-range{width:120px;accent-color:var(--dsw-alias-brand-primary,#4a9eff)}
.dsh-av-num{width:64px;padding:3px 8px;border-radius:6px;text-align:right;font-size:12px;
  background:var(--dsw-alias-bg-layer-1,#1e1e1e);color:var(--dsw-alias-label-primary,#ddd);
  border:1px solid var(--dsw-alias-border-l1,#555)}
.dsh-av-size-val{min-width:52px;text-align:right;color:var(--dsw-alias-label-secondary,#999)}
.dsh-av-seg{display:inline-flex;border:1px solid var(--dsw-alias-border-l1,#555);border-radius:6px;overflow:hidden}
.dsh-av-seg-btn{padding:4px 10px;font-size:12px;cursor:pointer;border:none;background:transparent;
  color:var(--dsw-alias-label-secondary,#999)}
.dsh-av-seg-btn + .dsh-av-seg-btn{border-left:1px solid var(--dsw-alias-border-l1,#555)}
.dsh-av-seg-btn:hover{color:var(--dsw-alias-label-primary,#ddd)}
.dsh-av-seg-btn.active{background:var(--dsw-alias-brand-primary,#4a9eff);color:#fff}
.dsh-av-toggle{position:relative;width:38px;height:22px;flex:none;cursor:pointer}
.dsh-av-toggle input{opacity:0;width:0;height:0}
.dsh-av-toggle .track{position:absolute;inset:0;border-radius:11px;transition:background .16s;
  background:var(--dsw-alias-label-tertiary,#8a8a8a);border:1px solid var(--dsw-alias-border-l1,#666)}
.dsh-av-toggle .track::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
  background:var(--dsw-alias-bg-overlay,#f2f2f2);transition:left .16s;box-shadow:0 1px 3px rgba(0,0,0,.35)}
.dsh-av-toggle input:checked + .track{background:var(--dsw-alias-brand-primary,#4a9eff);border-color:transparent}
.dsh-av-toggle input:checked + .track::after{left:18px}
.dsh-av-toggle input:focus-visible + .track{outline:2px solid var(--dsw-alias-brand-primary,#4a9eff);outline-offset:2px}
.dsh-av-status{font-size:12px;color:var(--dsw-alias-state-error-primary,#e05252);min-height:16px}
`
