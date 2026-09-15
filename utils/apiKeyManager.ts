import { ApiKeyItem } from '../types';

const STORAGE_KEY_LIST = 'kb_api_keys';
const STORAGE_KEY_ACTIVE = 'gemini_api_key';
const EVENT_KEY_CHANGED = 'kb_api_keys_changed';

// Get list of saved API keys
export const getStoredApiKeys = (): ApiKeyItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LIST);
    if (raw !== null) {
      return JSON.parse(raw) as ApiKeyItem[];
    }

    // First time only: If list was never initialized in storage, migrate legacy active key if present
    const activeKey = getActiveApiKey();
    if (activeKey) {
      const migratedItem: ApiKeyItem = {
        id: 'key-' + Date.now(),
        name: 'Gemini Key Mặc Định',
        key: activeKey,
        provider: 'gemini',
        notes: 'Tự động nhập từ cấu hình trước đó',
        isActive: true,
        createdAt: new Date().toISOString()
      };
      const list = [migratedItem];
      localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(list));
      return list;
    }

    return [];
  } catch (e) {
    console.error('Error reading API keys from storage:', e);
    return [];
  }
};

// Save a new API key
export const saveStoredApiKey = (
  item: Omit<ApiKeyItem, 'id' | 'createdAt'> & { id?: string }
): ApiKeyItem => {
  const list = getStoredApiKeys();
  const newItem: ApiKeyItem = {
    id: item.id || `key-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: item.name.trim() || 'Gemini Key',
    key: item.key.trim(),
    provider: item.provider || 'gemini',
    notes: item.notes?.trim() || '',
    isActive: !!item.isActive,
    createdAt: new Date().toISOString()
  };

  if (newItem.isActive) {
    // Unset other active keys
    list.forEach(k => { k.isActive = false; });
    localStorage.setItem(STORAGE_KEY_ACTIVE, newItem.key);
  }

  list.unshift(newItem);
  localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(list));
  notifyKeyChanges();
  return newItem;
};

// Update an existing API key
export const updateStoredApiKey = (id: string, updates: Partial<ApiKeyItem>): void => {
  const list = getStoredApiKeys();
  const index = list.findIndex(k => k.id === id);
  if (index === -1) return;

  const current = list[index];
  const updated = { ...current, ...updates };

  if (updates.isActive) {
    list.forEach(k => { k.isActive = false; });
    updated.isActive = true;
    localStorage.setItem(STORAGE_KEY_ACTIVE, updated.key);
  }

  list[index] = updated;
  localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(list));
  notifyKeyChanges();
};

// Delete an API key
export const deleteStoredApiKey = (id: string): void => {
  const list = getStoredApiKeys();
  const target = list.find(k => k.id === id);
  const filtered = list.filter(k => k.id !== id);
  localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(filtered));

  if (target?.isActive || getActiveApiKey() === target?.key) {
    if (filtered.length > 0) {
      filtered[0].isActive = true;
      localStorage.setItem(STORAGE_KEY_ACTIVE, filtered[0].key);
      localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(filtered));
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    }
  }

  notifyKeyChanges();
};

// Set a specific key as active
export const setActiveApiKey = (keyString: string, id?: string): void => {
  const cleanKey = keyString.trim();
  const list = getStoredApiKeys();
  let found = false;

  list.forEach(k => {
    if ((id && k.id === id) || (!id && k.key === cleanKey)) {
      k.isActive = true;
      found = true;
    } else {
      k.isActive = false;
    }
  });

  if (cleanKey) {
    localStorage.setItem(STORAGE_KEY_ACTIVE, cleanKey);
  } else {
    localStorage.removeItem(STORAGE_KEY_ACTIVE);
  }

  localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(list));
  notifyKeyChanges();
};

// Get the currently active key string
export const getActiveApiKey = (): string => {
  return localStorage.getItem(STORAGE_KEY_ACTIVE) || '';
};

// Mask API key for secure display: AIzaSy...9xYz
export const maskApiKey = (key: string): string => {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 10) return '••••••••';
  return `${trimmed.substring(0, 7)}...${trimmed.substring(trimmed.length - 4)}`;
};

// Trigger cross-component sync event
export const notifyKeyChanges = (): void => {
  window.dispatchEvent(new CustomEvent(EVENT_KEY_CHANGED));
};

// Hook/Listener for key changes
export const subscribeApiKeyChanges = (callback: () => void): (() => void) => {
  const handler = () => callback();
  window.addEventListener(EVENT_KEY_CHANGED, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_KEY_CHANGED, handler);
    window.removeEventListener('storage', handler);
  };
};

// Test Gemini API key validity and quota
export const testGeminiApiKey = async (
  key: string
): Promise<{ success: boolean; message: string; details?: any }> => {
  const cleanKey = key.trim();
  if (!cleanKey) {
    return { success: false, message: 'Vui lòng nhập API Key trước khi kiểm tra.' };
  }

  try {
    const startTime = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
    );
    const latency = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || response.statusText || 'Lỗi không xác định';
      if (response.status === 429 || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota')) {
        return {
          success: false,
          message: `Hết hạn mức Quota (429): ${errMsg}`,
          details: { status: response.status, error: errMsg }
        };
      }
      if (response.status === 400 || response.status === 403 || errMsg.includes('API_KEY_INVALID')) {
        return {
          success: false,
          message: `Khóa không hợp lệ (${response.status}): ${errMsg}`,
          details: { status: response.status, error: errMsg }
        };
      }
      return {
        success: false,
        message: `Lỗi kết nối (${response.status}): ${errMsg}`,
        details: { status: response.status, error: errMsg }
      };
    }

    const models = Array.isArray(data.models) ? data.models.length : 0;
    return {
      success: true,
      message: `Key hoạt động tốt! Độ trễ: ${latency}ms (Tìm thấy ${models} models).`,
      details: { latency, modelsCount: models }
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Lỗi mạng khi kiểm tra key: ${err.message || 'Không thể kết nối đến Google API'}`
    };
  }
};
