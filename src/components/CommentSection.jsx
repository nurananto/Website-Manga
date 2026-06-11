import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Reply, Send, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { timeAgo } from '../utils';
import { getAccessToken } from '../lib/auth';

// ── Avatar ─────────────────────────────────────────────────────
function UserAvatar({ user, size = 'md' }) {
  const cls = size === 'sm'
    ? 'w-6 h-6 sm:w-7 sm:h-7 text-[9px] sm:text-[10px]'
    : 'w-7 h-7 sm:w-8 sm:h-8 text-[10px] sm:text-xs';
  const name = user?.name || 'User';
  return (
    <div className={`${cls} rounded-full overflow-hidden bg-surface-container-high border border-white/10 shrink-0 flex items-center justify-center`}>
      {user?.avatar
        ? <img src={user.avatar} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        : <span className="font-black text-primary select-none">{name.slice(0, 2).toUpperCase()}</span>
      }
    </div>
  );
}

// ── Input komentar / balasan ───────────────────────────────────
function CommentInput({ onSubmit, submitting, placeholder = 'Tulis komentar...', autoFocus = false, onCancel, initialText = '' }) {
  const [text, setText] = useState(initialText);
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus) setTimeout(() => {
      ref.current?.focus();
      // Taruh kursor di akhir teks
      const len = ref.current?.value?.length || 0;
      ref.current?.setSelectionRange(len, len);
    }, 50);
  }, [autoFocus]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    onSubmit(trimmed);
    setText('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-on-surface placeholder:text-outline/40 resize-none focus:outline-none focus:border-primary/50 transition-colors"
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-outline hover:text-on-surface rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
            Batal
          </button>
        )}
        <button type="submit" disabled={submitting || !text.trim()}
          className="px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-40 flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer">
          <Send className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          {submitting ? 'Mengirim...' : 'Kirim'}
        </button>
      </div>
    </form>
  );
}

// ── Konfirmasi hapus inline ────────────────────────────────────
function DeleteConfirm({ onConfirm, onCancel, label = 'Hapus komentar ini?' }) {
  return (
    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-2.5 sm:px-3 py-2 mt-1.5 flex-wrap sm:flex-nowrap">
      <span className="text-[11px] sm:text-xs text-red-400 font-semibold flex-1 min-w-0">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={onConfirm}
          className="text-[10px] sm:text-[11px] font-black text-white bg-red-500 hover:bg-red-600 rounded-lg px-2.5 py-1 transition-colors cursor-pointer">
          Hapus
        </button>
        <button onClick={onCancel}
          className="text-[10px] sm:text-[11px] font-bold text-outline/70 hover:text-on-surface bg-white/5 hover:bg-white/10 rounded-lg px-2 py-1 transition-colors cursor-pointer">
          Batal
        </button>
      </div>
    </div>
  );
}

// ── Reply item ─────────────────────────────────────────────────
function ReplyItem({ reply, currentUserId, targetCommentId, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const isTarget = reply.id === targetCommentId;
  const isOwn    = reply.user?.id === currentUserId;
  const ref = useRef(null);

  useEffect(() => {
    if (isTarget && ref.current)
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'instant', block: 'center' }), 300);
  }, [isTarget]);

  return (
    <div
      ref={ref}
      data-comment-id={reply.id}
      className={`flex gap-2 sm:gap-2.5 pl-2.5 sm:pl-3 border-l-2 transition-all ${
        isTarget ? 'border-primary bg-primary/5 rounded-r-xl px-2.5 py-1.5' : 'border-white/10'
      }`}
    >
      <UserAvatar user={reply.user} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-[11px] sm:text-xs font-bold text-on-surface">{reply.user?.name || 'User'}</span>
          <span className="text-[9px] sm:text-[10px] text-outline/50">{timeAgo(reply.created_at)}</span>
          {isOwn && !confirmDel && (
            <button onClick={() => setConfirmDel(true)}
              className="ml-auto flex items-center gap-0.5 text-[10px] text-outline/30 hover:text-red-400 transition-colors cursor-pointer">
              <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
          )}
        </div>
        <p className="text-xs sm:text-sm text-on-surface/80 mt-0.5 break-words leading-relaxed">{reply.text}</p>
        {confirmDel && (
          <DeleteConfirm
            label="Hapus balasan ini?"
            onConfirm={() => onDelete(reply.id)}
            onCancel={() => setConfirmDel(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Comment item ───────────────────────────────────────────────
function CommentItem({ comment, isLoggedIn, currentUserId, onReply, onDelete, onDeleteReply, targetCommentId }) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies,    setShowReplies]    = useState(true);
  const [submitting,     setSubmitting]     = useState(false);
  const [confirmDel,     setConfirmDel]     = useState(false);
  const isTarget  = comment.id === targetCommentId;
  const isOwn    = comment.user?.id === currentUserId;
  const canReply = isLoggedIn;
  const isDeleted = comment.deleted === true;
  const replies   = comment.replies || [];
  const ref = useRef(null);

  useEffect(() => {
    if (isTarget && ref.current)
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'instant', block: 'center' }), 300);
  }, [isTarget]);

  const handleReply = async (text) => {
    setSubmitting(true);
    await onReply(comment.id, text);
    setSubmitting(false);
    setShowReplyInput(false);
  };

  // Indentasi balasan — lebih kecil di mobile
  const replyIndent = 'ml-9 sm:ml-11';

  return (
    <div
      ref={ref}
      data-comment-id={comment.id}
      className={`flex flex-col transition-all ${
        isTarget ? 'bg-primary/5 rounded-xl p-2.5 sm:p-3 border border-primary/20' : ''
      }`}
    >
      {/* Header + teks */}
      <div className="flex gap-2 sm:gap-3">
        <UserAvatar user={isDeleted ? null : comment.user} />
        <div className="flex-1 min-w-0">
          {isDeleted ? (
            /* Komentar sudah dihapus — teks diganti, replies tetap */
            <p className="text-xs sm:text-sm text-outline/40 italic">Komentar ini telah dihapus.</p>
          ) : (
            <>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-[11px] sm:text-xs font-bold text-on-surface">{comment.user?.name || 'User'}</span>
                <span className="text-[9px] sm:text-[10px] text-outline/50">{timeAgo(comment.created_at)}</span>
              </div>
              <p className="text-xs sm:text-sm text-on-surface/80 mt-0.5 break-words leading-relaxed">{comment.text}</p>

              {/* Action bar */}
              {!confirmDel && (
                <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2">
                  {canReply && (
                    <button
                      onClick={() => { setShowReplyInput(v => !v); setConfirmDel(false); }}
                      className={`flex items-center gap-1 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
                        showReplyInput ? 'text-primary' : 'text-outline/50 hover:text-primary'
                      }`}
                    >
                      <Reply className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      {showReplyInput ? 'Tutup' : 'Balas'}
                    </button>
                  )}
                  {isOwn && (
                    <button onClick={() => { setConfirmDel(true); setShowReplyInput(false); }}
                      className="flex items-center gap-1 text-[10px] sm:text-[11px] text-outline/30 hover:text-red-400 transition-colors cursor-pointer">
                      <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      Hapus
                    </button>
                  )}
                </div>
              )}

              {/* Konfirmasi hapus */}
              {confirmDel && (
                <DeleteConfirm
                  onConfirm={() => onDelete(comment.id, replies.length > 0)}
                  onCancel={() => setConfirmDel(false)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Kotak reply — muncul di bawah komentar, sebelum daftar balasan */}
      {showReplyInput && (
        <div className={`${replyIndent} mt-2.5 sm:mt-3`}>
          <CommentInput
            onSubmit={handleReply}
            submitting={submitting}
            placeholder="Tulis balasan..."
            initialText={`@${comment.user?.name || 'User'} `}
            autoFocus
            onCancel={() => setShowReplyInput(false)}
          />
        </div>
      )}

      {/* Daftar balasan */}
      {replies.length > 0 && (
        <div className={`flex flex-col gap-0 ${replyIndent} mt-2.5 sm:mt-3`}>
          {!showReplies ? (
            <button
              onClick={() => setShowReplies(true)}
              className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-primary/70 hover:text-primary transition-colors cursor-pointer"
            >
              <ChevronDown className="w-3 h-3" />
              Lihat {replies.length} balasan
            </button>
          ) : (
            <>
              <div className="flex flex-col gap-2.5 sm:gap-3">
                {replies.map(r => (
                  <ReplyItem
                    key={r.id}
                    reply={r}
                    currentUserId={currentUserId}
                    targetCommentId={targetCommentId}
                    onDelete={(rid) => onDeleteReply(comment.id, rid)}
                  />
                ))}
              </div>
              {replies.length > 1 && (
                <button
                  onClick={() => setShowReplies(false)}
                  className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-outline/40 hover:text-outline/70 transition-colors cursor-pointer mt-1.5"
                >
                  <ChevronUp className="w-3 h-3" />
                  Sembunyikan balasan
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────
function CommentSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {[1, 2].map(i => (
        <div key={i} className="flex gap-2 sm:gap-3 animate-pulse">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-2 sm:h-2.5 bg-white/10 rounded w-20 sm:w-24" />
            <div className="h-3 sm:h-4 bg-white/10 rounded w-full" />
            <div className="h-3 sm:h-4 bg-white/10 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Export utama ───────────────────────────────────────────────
export default function CommentSection({ chapterId, mangaId, isLoggedIn, currentUser, onLoginClick, targetCommentId }) {
  const [comments,   setComments]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const workerUrl = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');
  const currentUserId = currentUser?.id || null;

  useEffect(() => {
    if (!chapterId || !workerUrl) return;
    setLoading(true);
    setComments([]);
    fetch(`${workerUrl}/api/comments?chapter=${encodeURIComponent(chapterId)}`)
      .then(r => r.ok ? r.json() : { comments: [] })
      .then(data => setComments(data.comments || []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [chapterId]);

  const getToken = () => getAccessToken();

  const handleSubmit = async (text) => {
    const token = await getToken();
    if (!token || !workerUrl) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${workerUrl}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chapter_id: chapterId, manga_id: mangaId, text }),
      });
      if (res.ok) { const data = await res.json(); setComments(prev => [data, ...prev]); }
    } catch {}
    setSubmitting(false);
  };

  const handleReply = async (parentId, text) => {
    const token = await getToken();
    if (!token || !workerUrl) return;
    try {
      const res = await fetch(`${workerUrl}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chapter_id: chapterId, manga_id: mangaId, text, parent_id: parentId }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => prev.map(c =>
          c.id === parentId ? { ...c, replies: [...(c.replies || []), data] } : c
        ));
      }
    } catch {}
  };

  // Hapus komentar: kalau ada reply → soft delete (teks jadi "dihapus"), kalau kosong → hilangkan
  const handleDelete = async (commentId, hasReplies) => {
    const token = await getToken();
    if (!workerUrl || !token) {
      // Demo: soft/hard delete lokal
      if (hasReplies) {
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, deleted: true } : c));
      } else {
        setComments(prev => prev.filter(c => c.id !== commentId));
      }
      return;
    }
    try {
      const res = await fetch(`${workerUrl}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        if (hasReplies) {
          setComments(prev => prev.map(c => c.id === commentId ? { ...c, deleted: true } : c));
        } else {
          setComments(prev => prev.filter(c => c.id !== commentId));
        }
      }
    } catch {}
  };

  const handleDeleteReply = async (parentId, replyId) => {
    const token = await getToken();
    if (!workerUrl || !token) {
      setComments(prev => prev.map(c =>
        c.id === parentId ? { ...c, replies: (c.replies || []).filter(r => r.id !== replyId) } : c
      ));
      return;
    }
    try {
      const res = await fetch(`${workerUrl}/api/comments/${replyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setComments(prev => prev.map(c =>
          c.id === parentId ? { ...c, replies: (c.replies || []).filter(r => r.id !== replyId) } : c
        ));
      }
    } catch {}
  };

  const currentUserInfo = isLoggedIn ? {
    name:   currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'User',
    avatar: currentUser?.user_metadata?.avatar_url || null,
  } : null;

  const totalCount = comments.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);

  return (
    <div className="w-full px-3 sm:px-4 py-4 sm:py-6 flex flex-col gap-4 sm:gap-5 font-body-md">
      {/* Header */}
      <div className="flex items-center gap-2 border-t border-white/10 pt-4 sm:pt-6">
        <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
        <h3 className="text-xs sm:text-sm font-bold text-on-surface">Komentar</h3>
        {!loading && totalCount > 0 && (
          <span className="text-[11px] sm:text-xs text-outline/50 font-semibold">({totalCount})</span>
        )}
      </div>

      {/* Input area */}
      {isLoggedIn ? (
        <div className="flex gap-2 sm:gap-3">
          <UserAvatar user={currentUserInfo} />
          <div className="flex-1">
            <CommentInput onSubmit={handleSubmit} submitting={submitting} />
          </div>
        </div>
      ) : (
        <div className="flex gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-surface-container-high border border-white/10 shrink-0 flex items-center justify-center">
            <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-outline/30" />
          </div>
          <div
            className="flex-1 flex items-center gap-2 sm:gap-3 bg-surface-container-high border border-white/10 rounded-xl px-3 py-2.5 cursor-pointer hover:border-primary/40 transition-colors"
            onClick={onLoginClick}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onLoginClick?.()}
          >
            <span className="flex-1 text-xs sm:text-sm text-outline/30 pointer-events-none select-none">
              Login untuk berkomentar...
            </span>
            <span className="shrink-0 px-3 py-1.5 text-[11px] sm:text-xs font-bold text-on-primary bg-primary rounded-lg pointer-events-none select-none">
              Masuk / Login
            </span>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <CommentSkeleton />
      ) : comments.length === 0 ? (
        <p className="text-center text-xs sm:text-sm text-outline/30 py-5 sm:py-6 font-semibold">
          Belum ada komentar. Jadilah yang pertama!
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {comments.map((c, i) => (
            <div key={c.id} className={i > 0 ? 'pt-4 sm:pt-5' : ''}>
              <CommentItem
                comment={c}
                isLoggedIn={isLoggedIn}
                currentUserId={currentUserId}
                onReply={handleReply}
                onDelete={handleDelete}
                onDeleteReply={handleDeleteReply}
                targetCommentId={targetCommentId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
