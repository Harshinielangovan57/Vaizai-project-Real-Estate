// src/store/slices/notificationsSlice.js
import { createSlice } from '@reduxjs/toolkit';

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],      // { id, type, message, read, createdAt }
    unread: 0,
  },
  reducers: {
    addNotification(state, action) {
      state.items.unshift(action.payload);
      state.unread += 1;
    },
    markAllRead(state) {
      state.items = state.items.map((n) => ({ ...n, read: true }));
      state.unread = 0;
    },
    markRead(state, action) {
      const item = state.items.find((n) => n.id === action.payload);
      if (item && !item.read) {
        item.read = true;
        state.unread = Math.max(0, state.unread - 1);
      }
    },
    clearAll(state) {
      state.items  = [];
      state.unread = 0;
    },
  },
});

export const { addNotification, markAllRead, markRead, clearAll } =
  notificationsSlice.actions;
export default notificationsSlice.reducer;