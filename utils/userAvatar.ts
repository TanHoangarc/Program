import { UserAccount, OnlineUser } from '../types';
import { doc, setDoc, deleteDoc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firebase';

export const DEFAULT_ROLE_AVATARS: Record<string, string> = {
  Admin: 'https://i.pinimg.com/1200x/ab/6c/ca/ab6cca0e9729b971bf5fb0e4ee78fdc1.jpg',
  Docs: 'https://i.pinimg.com/736x/88/dd/b4/88ddb4d5b2a7556fda455dcb871614c2.jpg',
  Cus: 'https://i.pinimg.com/1200x/a8/6b/a2/a86ba221bd2b387f29a02542c9e1434c.jpg'
};

export const PRESET_AVATARS = [
  {
    id: 'admin_exec',
    name: 'Quản trị viên Cao Cấp (Admin)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=300&q=80',
    role: 'Admin'
  },
  {
    id: 'admin_tech',
    name: 'Quản trị Hệ thống (IT System)',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=300&q=80',
    role: 'Admin'
  },
  {
    id: 'docs_specialist',
    name: 'Chứng từ Xuất Nhập Khẩu (Docs)',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&h=300&q=80',
    role: 'Docs'
  },
  {
    id: 'shipping_captain',
    name: 'Thuyền trưởng / Điều hành Tàu',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&h=300&q=80',
    role: 'Docs'
  },
  {
    id: 'logistics_port',
    name: 'Giao nhận Cảng / Ops',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&h=300&q=80',
    role: 'Docs'
  },
  {
    id: 'accountant',
    name: 'Kế toán & Tài chính AMIS',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&h=300&q=80',
    role: 'Admin'
  },
  {
    id: 'cus_partner',
    name: 'CSKH (Chăm sóc khách hàng)',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&h=300&q=80',
    role: 'Cus'
  },
  {
    id: 'cus_global',
    name: 'Đại lý Quốc tế (Global Agent)',
    url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&h=300&q=80',
    role: 'Cus'
  },
  {
    id: 'anime_admin',
    name: 'Avatar Anime Admin (Mặc định)',
    url: 'https://i.pinimg.com/1200x/ab/6c/ca/ab6cca0e9729b971bf5fb0e4ee78fdc1.jpg',
    role: 'Admin'
  },
  {
    id: 'anime_docs',
    name: 'Avatar Anime Docs (Mặc định)',
    url: 'https://i.pinimg.com/736x/88/dd/b4/88ddb4d5b2a7556fda455dcb871614c2.jpg',
    role: 'Docs'
  },
  {
    id: 'anime_cus',
    name: 'Avatar Anime CSKH (Mặc định)',
    url: 'https://i.pinimg.com/1200x/a8/6b/a2/a86ba221bd2b387f29a02542c9e1434c.jpg',
    role: 'Cus'
  }
];

export const getUserAvatar = (user: UserAccount | null | { username?: string; role?: string; avatar?: string }): string => {
  if (!user || !user.username) {
    return DEFAULT_ROLE_AVATARS.Admin;
  }

  // 1. Check local override
  try {
    const saved = localStorage.getItem(`kb_avatar_${user.username}`);
    if (saved && saved.trim()) {
      return saved;
    }
  } catch {}

  // 2. Check user property
  if (user.avatar && user.avatar.trim()) {
    return user.avatar;
  }

  // 3. Fallback based on known username / role
  const uname = (user.username || '').toLowerCase();
  const role = (user.role || '').toLowerCase();

  if (uname.includes('admin') || role === 'admin') {
    return DEFAULT_ROLE_AVATARS.Admin;
  }
  if (uname.includes('doc') || role === 'docs') {
    return DEFAULT_ROLE_AVATARS.Docs;
  }
  if (uname.includes('cus') || role === 'cus') {
    return DEFAULT_ROLE_AVATARS.Cus;
  }

  return DEFAULT_ROLE_AVATARS.Admin;
};

export const setUserAvatar = (username: string, avatarUrl: string): void => {
  if (!username) return;
  try {
    localStorage.setItem(`kb_avatar_${username}`, avatarUrl);
    // Broadcast change
    window.dispatchEvent(new CustomEvent('kb_avatar_changed', { detail: { username, avatarUrl } }));
  } catch (err) {
    console.error('Failed to save avatar', err);
  }
};

export const getRoleBadge = (role?: string) => {
  const r = (role || '').toLowerCase();
  if (r === 'admin') {
    return {
      label: 'Admin',
      badgeClass: 'bg-purple-100 text-purple-700 border border-purple-200'
    };
  }
  if (r === 'docs') {
    return {
      label: 'Chứng từ (Docs)',
      badgeClass: 'bg-blue-100 text-blue-700 border border-blue-200'
    };
  }
  if (r === 'cus') {
    return {
      label: 'CSKH',
      badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    };
  }
  return {
    label: role || 'Thành viên',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200'
  };
};

export type { OnlineUser };

const PRESENCE_KEY = 'kb_active_online_sessions';
let sessionLoginTime = '';

export const registerUserHeartbeat = async (user: UserAccount | null) => {
  if (!user || !user.username) return;

  if (!sessionLoginTime) {
    sessionLoginTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  const now = Date.now();
  const avatar = getUserAvatar(user);
  const sessionData: OnlineUser = {
    username: user.username,
    role: user.role,
    avatar,
    displayName: user.displayName || user.username,
    lastSeen: now,
    loginTime: sessionLoginTime
  };

  // 1. Update localStorage cache for instant local display
  try {
    const raw = localStorage.getItem(PRESENCE_KEY);
    let sessions: OnlineUser[] = raw ? JSON.parse(raw) : [];
    sessions = sessions.filter(s => now - s.lastSeen < 45000 && s.username !== user.username);
    sessions.push(sessionData);
    localStorage.setItem(PRESENCE_KEY, JSON.stringify(sessions));
  } catch {}

  // 2. Real-time Firebase Firestore Sync (accessible from ANY computer/browser)
  try {
    const presenceRef = doc(db, 'online_presence', user.username);
    await setDoc(presenceRef, {
      ...sessionData,
      updatedAt: now
    }, { merge: true });
  } catch (err) {
    // If firestore is offline, continue silently
  }

  // 3. Fallback to Server Presence API
  try {
    fetch('/api/presence/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    }).catch(() => {});
  } catch {}
};

export const removeUserHeartbeat = async (username: string) => {
  if (!username) return;

  // 1. Local cleanup
  try {
    const raw = localStorage.getItem(PRESENCE_KEY);
    if (raw) {
      let sessions: OnlineUser[] = JSON.parse(raw);
      sessions = sessions.filter(s => s.username !== username);
      localStorage.setItem(PRESENCE_KEY, JSON.stringify(sessions));
    }
  } catch {}

  // 2. Remove from Firebase Firestore
  try {
    const presenceRef = doc(db, 'online_presence', username);
    await deleteDoc(presenceRef);
  } catch {}

  // 3. Notify server
  try {
    fetch('/api/presence/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    }).catch(() => {});
  } catch {}

  // Broadcast local change
  window.dispatchEvent(new CustomEvent('kb_online_users_updated', { detail: [] }));
};

export const getOnlineUsers = (): OnlineUser[] => {
  try {
    const raw = localStorage.getItem(PRESENCE_KEY);
    if (!raw) return [];
    const sessions: OnlineUser[] = JSON.parse(raw);
    const now = Date.now();
    return sessions.filter(s => now - s.lastSeen < 45000);
  } catch {
    return [];
  }
};

/**
 * Subscribes to cross-device online users.
 * Uses Firebase Firestore real-time listener as primary channel (instant updates across computers),
 * with server API polling and local storage as fallbacks.
 */
export const subscribeToOnlineUsers = (callback: (users: OnlineUser[]) => void): (() => void) => {
  let isUnsubscribed = false;

  const processAndNotify = (rawList: OnlineUser[]) => {
    const now = Date.now();
    // Filter active sessions within 45s timeout
    const active = rawList.filter(u => u && u.username && (now - u.lastSeen < 45000));
    
    // Sort so Admin comes first, then alphabetically
    active.sort((a, b) => {
      const aAdmin = a.role?.toLowerCase() === 'admin';
      const bAdmin = b.role?.toLowerCase() === 'admin';
      if (aAdmin && !bAdmin) return -1;
      if (!aAdmin && bAdmin) return 1;
      return a.username.localeCompare(b.username);
    });

    try {
      localStorage.setItem(PRESENCE_KEY, JSON.stringify(active));
    } catch {}

    callback(active);
  };

  // Initial call with cached data
  callback(getOnlineUsers());

  // 1. Firebase Firestore onSnapshot listener for instant cross-device updates
  let unsubscribeFirestore = () => {};
  try {
    const presenceCol = collection(db, 'online_presence');
    unsubscribeFirestore = onSnapshot(presenceCol, (snapshot) => {
      if (isUnsubscribed) return;
      const list: OnlineUser[] = [];
      snapshot.forEach(docSnap => {
        const item = docSnap.data() as OnlineUser;
        if (item && item.username) {
          list.push(item);
        }
      });
      processAndNotify(list);
    }, (err) => {
      console.warn("Firestore presence onSnapshot warning:", err);
    });
  } catch (e) {
    console.warn("Could not attach firestore presence listener:", e);
  }

  // 2. Server polling fallback every 10 seconds
  const fetchFromServer = async () => {
    if (isUnsubscribed) return;
    try {
      const res = await fetch('/api/presence/online-users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.onlineUsers)) {
          processAndNotify(data.onlineUsers);
        }
      }
    } catch {}
  };

  fetchFromServer();
  const pollTimer = setInterval(fetchFromServer, 10000);

  // 3. Local custom event listener
  const handleLocalUpdate = (e: any) => {
    if (Array.isArray(e.detail) && e.detail.length > 0) {
      processAndNotify(e.detail);
    }
  };
  window.addEventListener('kb_online_users_updated', handleLocalUpdate);

  return () => {
    isUnsubscribed = true;
    clearInterval(pollTimer);
    unsubscribeFirestore();
    window.removeEventListener('kb_online_users_updated', handleLocalUpdate);
  };
};
