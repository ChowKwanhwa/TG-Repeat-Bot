'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { PencilSquareIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface SessionInfo {
  status: string;
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  about?: string;
  photo?: string;
  message?: string;
}

interface Session {
  path: string;
  name: string;
  folder: string;
  info?: SessionInfo;
  scanning?: boolean;
}

interface Folder {
  name: string;
  session_count: number;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [scanningAll, setScanningAll] = useState(false);

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    about: '',
    file: null as File | null
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    fetchSessions(selectedFolder);
  }, [selectedFolder]);

  const fetchFolders = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/folders`);
      setFolders(res.data);
      // Auto-select first folder if available
      if (res.data.length > 0 && !selectedFolder) {
        setSelectedFolder(res.data[0].name);
      }
    } catch (err) {
      console.error('Failed to fetch folders', err);
    }
  };

  const fetchSessions = async (folder?: string) => {
    setLoading(true);
    try {
      const url = folder ? `${API_BASE}/api/sessions?folder=${encodeURIComponent(folder)}` : `${API_BASE}/api/sessions`;
      const res = await axios.get(url);
      // Preserve existing info if re-fetching? Or just reset. Let's reset for now to be simple.
      // Or better: update listing but keep info if path matches.
      const newSessions: Session[] = res.data.map((s: any) => ({
        ...s,
        scanning: false,
        info: undefined
      }));
      setSessions(newSessions);
    } catch (err) {
      alert('Failed to fetch sessions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const scanSession = async (session: Session) => {
    setSessions(prev => prev.map(s => s.path === session.path ? { ...s, scanning: true } : s));

    try {
      const res = await axios.post(`${API_BASE}/api/session/scan`, { path: session.path });
      setSessions(prev => prev.map(s =>
        s.path === session.path ? { ...s, scanning: false, info: res.data } : s
      ));
    } catch (err) {
      console.error(err);
      setSessions(prev => prev.map(s =>
        s.path === session.path ? { ...s, scanning: false, info: { status: 'error', message: 'Network Error' } } : s
      ));
    }
  };

  const scanAllSessions = async () => {
    setScanningAll(true);
    // Batch process to be kind to the backend
    const batchSize = 3;
    const sessionsToScan = sessions.filter(s => !s.info || s.info.status !== 'authorized');

    for (let i = 0; i < sessionsToScan.length; i += batchSize) {
      const batch = sessionsToScan.slice(i, i + batchSize);
      await Promise.all(batch.map(s => scanSession(s)));
    }
    setScanningAll(false);
  };

  const openEdit = (session: Session) => {
    if (!session.info) return;
    setEditingSession(session);
    setEditForm({
      first_name: session.info.first_name || '',
      last_name: session.info.last_name || '',
      username: session.info.username || '',
      about: session.info.about || '',
      file: null
    });
    setIsModalOpen(true);
  };

  const saveEdit = async () => {
    if (!editingSession) return;
    setSaving(true);

    const formData = new FormData();
    formData.append('session_path', editingSession.path);
    formData.append('first_name', editForm.first_name);
    formData.append('last_name', editForm.last_name);
    formData.append('username', editForm.username);
    formData.append('about', editForm.about);
    if (editForm.file) {
      formData.append('file', editForm.file);
    }

    try {
      await axios.post(`${API_BASE}/api/session/update`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Updated Successfully!');
      setIsModalOpen(false);
      // Re-scan to update UI
      scanSession(editingSession);
    } catch (err: any) {
      alert('Update Failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Session Manager</h1>
          <div className="flex items-center gap-4">
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Folders</option>
              {folders.map((folder) => (
                <option key={folder.name} value={folder.name}>
                  {folder.name} ({folder.session_count})
                </option>
              ))}
            </select>
            <button
              onClick={() => fetchSessions(selectedFolder)}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <ArrowPathIcon className="w-5 h-5 mr-2" />}
              Refresh
            </button>
            <button
              onClick={scanAllSessions}
              disabled={loading || scanningAll}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {scanningAll ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckCircleIcon className="w-5 h-5 mr-2" />}
              Scan All
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avatar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Info</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.map(session => (
                <tr key={session.path} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {session.info?.photo ? (
                      <img src={session.info.photo} alt="avatar" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">TG</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{session.name}</div>
                    <div className="text-xs text-gray-500 bg-gray-100 inline-block px-2 py-0.5 rounded mt-1">{session.folder}</div>
                  </td>
                  <td className="px-6 py-4">
                    {session.info ? (
                      <div>
                        <div className="text-sm font-semibold">{session.info.first_name || ''} {session.info.last_name || ''}</div>
                        <div className="text-xs text-gray-500">@{session.info.username || 'No Username'}</div>
                        <div className="text-xs text-gray-400">ID: {session.info.id}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {session.scanning ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" /> Scanning
                      </span>
                    ) : session.info?.status === 'authorized' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircleIcon className="w-3 h-3 mr-1" /> Authorized
                      </span>
                    ) : session.info ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircleIcon className="w-3 h-3 mr-1" /> {session.info.status || 'Error'}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs text-black">Ready</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => scanSession(session)}
                      disabled={session.scanning}
                      className="text-blue-600 hover:text-blue-900 px-2 py-1 border border-blue-600 rounded mr-2 hover:bg-blue-50 disabled:opacity-50"
                    >
                      Scan
                    </button>
                    <button
                      onClick={() => openEdit(session)}
                      disabled={!session.info || session.info.status !== 'authorized'}
                      className="text-indigo-600 hover:text-indigo-900 px-2 py-1 border border-indigo-600 rounded hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <PencilSquareIcon className="w-4 h-4 inline mr-1" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No sessions found. Check your 'sessions' directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-black"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Username (no @)</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">About (Bio)</label>
                <textarea
                  value={editForm.about}
                  onChange={e => setEditForm({ ...editForm, about: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">New Profile Photo</label>
                <input
                  type="file"
                  onChange={e => setEditForm({ ...editForm, file: e.target.files ? e.target.files[0] : null })}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 text-black"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {saving && <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
