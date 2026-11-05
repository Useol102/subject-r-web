'use strict';
(() => {
  const root = document.getElementById('root');
  const flow = document.getElementById('flow');
  const feedback = document.getElementById('ui-feedback');
  const stages = ['menu', 'confirm', 'pay', 'done'];
  const labels = { start: '시작 화면', menu: '메뉴 선택', confirm: '주문 확인', pay: '결제 방식 선택', done: '주문 완료' };
  const help = {
    menu: '음료를 누른 뒤 온도·크기·수량을 선택해 주세요.',
    confirm: '메뉴와 수량, 총 금액을 확인해 주세요.',
    pay: '결제 방식을 눌러 연습을 마쳐 주세요. 실제로 결제되지 않습니다.',
    done: '주문 연습을 마쳤습니다. 실제 주문은 접수되지 않았습니다.'
  };
  let lastScreen = '';
  let lastDialog = null;
  let returnFocus = null;
  let previousTotal = '';
  function focusTitle(el) {
    if (!el) return;
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
  function sync() {
    const kiosk = root.querySelector('.kiosk');
    if (!kiosk) return;
    const screen = kiosk.dataset.screen;
    const changed = screen !== lastScreen;
    if (changed) {
      flow.hidden = screen === 'start';
      document.getElementById('flow-help').textContent = help[screen] || '';
      const current = stages.indexOf(screen);
      flow.querySelectorAll('li').forEach((li, index) => {
        li.classList.toggle('current', index === current);
        li.classList.toggle('done', index < current);
        if (index === current) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      document.title = `${labels[screen]} · 카페 주문 연습`;
      lastScreen = screen;
      focusTitle(root.querySelector('.hdr-title, .start-title'));
    }
    const next = root.querySelector('.cart .btn-main');
    if (next && next.textContent !== '주문 확인하기') next.textContent = '주문 확인하기';
    const empty = root.querySelector('.cart-empty');
    if (empty && empty.textContent !== '메뉴를 선택하면 이곳에 담겨요.') empty.textContent = '메뉴를 선택하면 이곳에 담겨요.';
    if (screen === 'done') {
      const display = [['.done-lead', '주문 연습을 마쳤어요'], ['.ticket-label', '연습 주문번호'], ['.done-guide', '확인을 누르면 처음부터 다시 연습할 수 있어요.']];
      display.forEach(([selector, text]) => {
        const el = root.querySelector(selector);
        if (el && el.textContent !== text) el.textContent = text;
      });
    }
    const dialog = root.querySelector('[role="dialog"], [role="alertdialog"]');
    if (dialog !== lastDialog) {
      if (dialog) {
        returnFocus = document.activeElement;
        focusTitle(dialog.querySelector('.dialog-title'));
      } else if (lastDialog && !changed && returnFocus && returnFocus.isConnected) {
        returnFocus.focus({ preventScroll: true });
      }
      lastDialog = dialog;
    }
    const total = root.querySelector('.cart-sum strong');
    if (total && total.textContent !== previousTotal) {
      if (previousTotal && !changed) feedback.textContent = `담은 메뉴의 총 금액은 ${total.textContent}입니다.`;
      previousTotal = total.textContent;
    }
  }
  // UI 표시에만 반응하며 원본의 상태나 가격 계산은 변경하지 않습니다.
  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-screen'] });
  document.addEventListener('keydown', event => {
    const dialog = root.querySelector('[role="dialog"], [role="alertdialog"]');
    if (!dialog) return;
    if (event.key === 'Escape') {
      const cancel = dialog.querySelector('.option .btn-gray, .pay-dialog .btn-gray');
      if (cancel) { event.preventDefault(); cancel.click(); }
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.querySelectorAll('button:not(:disabled)')].filter(el => el.getBoundingClientRect().height > 0);
    if (!buttons.length) return;
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
  });
  sync();
})();
