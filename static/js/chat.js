/* Healix AI Chat Widget — standalone, works on every page */
(function () {
  'use strict';

  var chatHistory = [];
  var chatOpen    = false;
  var chatBusy    = false;
  var chatGreeted = false;

  function $(id) { return document.getElementById(id); }

  function initChat() {
    var unread = $('chatUnread');
    if (unread) {
      unread.style.display = 'flex';
      setTimeout(function () {
        if (!chatOpen && $('chatUnread')) $('chatUnread').style.display = 'none';
      }, 8000);
    }
  }

  function toggleChat() {
    if (chatOpen) closeChat(); else openChat();
  }

  function openChat() {
    chatOpen = true;
    var win    = $('chatWindow');
    var unread = $('chatUnread');
    var ico    = $('chatBubbleIcon');
    var cls    = $('chatCloseIcon');
    if (win)    win.style.display    = 'flex';
    if (unread) unread.style.display = 'none';
    if (ico)    ico.style.display    = 'none';
    if (cls)    cls.style.display    = '';
    if (!chatGreeted) {
      chatGreeted = true;
      appendChatMessage('assistant',
        "Hi! I'm the Healix AI assistant. I can help you find medical supplies, " +
        "answer product questions, or connect you with our team. What can I help you with?");
    }
    setTimeout(scrollChatToBottom, 50);
    var inp = $('chatInput');
    if (inp) setTimeout(function () { inp.focus(); }, 150);
  }

  function closeChat() {
    chatOpen = false;
    var win = $('chatWindow');
    var ico = $('chatBubbleIcon');
    var cls = $('chatCloseIcon');
    if (win) win.style.display = 'none';
    if (ico) ico.style.display = '';
    if (cls) cls.style.display = 'none';
  }

  function appendChatMessage(role, content) {
    var msgs = $('chatMessages');
    if (!msgs) return;
    var div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    div.textContent = content;
    msgs.appendChild(div);
    scrollChatToBottom();
  }

  function showTyping() {
    var msgs = $('chatMessages');
    if (!msgs) return;
    var div = document.createElement('div');
    div.className = 'chat-typing';
    div.id = 'chatTyping';
    div.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(div);
    scrollChatToBottom();
  }

  function hideTyping() {
    var el = $('chatTyping');
    if (el) el.remove();
  }

  function scrollChatToBottom() {
    var msgs = $('chatMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  async function submitChatMessage() {
    if (chatBusy) return;
    var inp = $('chatInput');
    if (!inp) return;
    var text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    appendChatMessage('user', text);
    var sug = $('chatSuggestions');
    if (sug) sug.style.display = 'none';
    chatHistory.push({ role: 'user', content: text });
    chatBusy = true;
    var sendBtn = $('chatSendBtn');
    if (sendBtn) sendBtn.disabled = true;
    showTyping();
    try {
      var res  = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: chatHistory.slice(-10) }),
      });
      var data = await res.json();
      hideTyping();
      var reply = data.reply || "Sorry, I couldn't get a response. Please try again.";
      appendChatMessage('assistant', reply);
      chatHistory.push({ role: 'assistant', content: reply });
    } catch (err) {
      hideTyping();
      appendChatMessage('assistant', 'Something went wrong. Please try again or call (888) 585-6510.');
    } finally {
      chatBusy = false;
      if (sendBtn) sendBtn.disabled = false;
      if (inp) inp.focus();
    }
  }

  function sendSuggestion(text) {
    var inp = $('chatInput');
    if (inp) inp.value = text;
    submitChatMessage();
  }

  /* Expose globals for onclick= handlers in HTML */
  window.toggleChat        = toggleChat;
  window.openChat          = openChat;
  window.closeChat         = closeChat;
  window.submitChatMessage = submitChatMessage;
  window.sendSuggestion    = sendSuggestion;

  /* Auto-init on DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
  } else {
    initChat();
  }
})();
