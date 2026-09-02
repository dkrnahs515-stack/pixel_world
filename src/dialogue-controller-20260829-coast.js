export class DialogueController {
  constructor({ overlay, title, body, actionButton, actionContainer, onAction }) {
    this.overlay = overlay;
    this.title = title;
    this.body = body;
    this.actionButton = actionButton;
    this.actionContainer = actionContainer;
    this.onAction = onAction;
    this.action = null;
    this.actions = [];
    this.renderedActionButtons = [actionButton];

    this.actionButton.addEventListener("click", () => {
      if (this.action) this.choose(this.action);
    });
  }

  open(model) {
    const normalized = normalizeDialogueModel(model);
    this.title.textContent = normalized.title;
    this.body.textContent = normalized.body;
    this.actions = normalized.actions;
    this.action = normalized.actions[0]?.id || null;
    this.renderActions();
    this.overlay.hidden = false;
  }

  choose(actionId) {
    if (!this.actions.some(action => action.id === actionId)) return false;
    this.onAction?.(actionId);
    return true;
  }

  actionButtons() {
    return this.renderedActionButtons.filter(Boolean);
  }

  renderActions() {
    const [firstAction] = this.actions;
    this.actionButton.textContent = firstAction?.label || "대화 마치기";
    if (this.actionButton.dataset) delete this.actionButton.dataset.dialogueAction;

    if (!this.actionContainer?.replaceChildren) {
      this.renderedActionButtons = [this.actionButton];
      return;
    }

    const buttons = this.actions.map((action, index) => {
      if (index === 0) return this.configureActionButton(this.actionButton, action);
      const button = this.actionContainer.ownerDocument.createElement("button");
      button.type = "button";
      button.className = "primary-button dialogue-choice-button";
      button.addEventListener("click", () => this.choose(action.id));
      return this.configureActionButton(button, action);
    });
    this.actionContainer.replaceChildren(...buttons);
    this.renderedActionButtons = buttons;
  }

  configureActionButton(button, action) {
    button.textContent = action.label;
    button.dataset.dialogueAction = action.id;
    return button;
  }

  close() {
    this.overlay.hidden = true;
  }
}

export function normalizeDialogueModel(model = {}) {
  const pages = Array.isArray(model.pages)
    ? model.pages.filter(page => typeof page === "string" && page.length > 0)
    : [];
  const actions = Array.isArray(model.actions)
    ? model.actions
      .map(action => ({
        id: typeof action?.id === "string" ? action.id : action?.action,
        label: typeof action?.label === "string" ? action.label : action?.actionLabel,
      }))
      .filter(action => typeof action.id === "string" && action.id.length > 0 && typeof action.label === "string" && action.label.length > 0)
    : typeof model.action === "string" && typeof model.actionLabel === "string"
      ? [{ id: model.action, label: model.actionLabel }]
      : [];
  const uniqueActions = actions.filter((action, index) => actions.findIndex(candidate => candidate.id === action.id) === index);

  return {
    title: typeof model.title === "string" ? model.title : "",
    body: pages.length > 0 ? pages.join("\n") : (typeof model.body === "string" ? model.body : ""),
    actions: uniqueActions,
  };
}
