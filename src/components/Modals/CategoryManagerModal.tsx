import React, { useState } from 'react';
import { X, Plus, Tag, ShieldCheck, Trash2, Edit3 } from 'lucide-react';
import { CategoryInfo } from '../../types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryInfo[];
  // No `id` here — the server generates and owns it (see createCategory in
  // queries.ts) so it's guaranteed unique and stays stable even if the name
  // is renamed later. This form only ever supplies the human-facing fields.
  onAddCategory: (cat: { name: string; description?: string; color?: string; deltaThreshold?: number }) => void;
  onUpdateCategory?: (id: string, patch: Partial<CategoryInfo>) => void;
  onDeleteCategory?: (id: string) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#10b981');
  const [deltaThreshold, setDeltaThreshold] = useState(3.0);

  // Inline edit state for an existing category row
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDelta, setEditDelta] = useState(3.0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // The real typed display name — NOT slugified into an id here anymore.
    // The server generates its own stable id from this name at creation
    // time (see createCategory), so this form never needs to think about
    // ids at all.
    onAddCategory({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      deltaThreshold,
    });

    setName('');
    setDescription('');
    setColor('#10b981');
    setDeltaThreshold(3.0);
    onClose();
  };

  const startEditing = (cat: CategoryInfo) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDelta(cat.deltaThreshold || 3);
  };

  const cancelEditing = () => setEditingId(null);

  const saveEditing = (id: string) => {
    if (!editName.trim() || !onUpdateCategory) {
      setEditingId(null);
      return;
    }
    onUpdateCategory(id, { name: editName.trim(), deltaThreshold: editDelta });
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (!onDeleteCategory) return;
    if (window.confirm(`Xóa nhóm danh mục "${id}"? Các tên miền đang gắn nhóm này sẽ không tự động bị gỡ.`)) {
      onDeleteCategory(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-xs text-slate-700 dark:text-slate-300">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans flex items-center space-x-2">
            <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Quản lý nhóm danh mục (Categories)</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Current Categories List */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              CÁC NHÓM HIỆN CÓ ({categories.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
              {categories.map((c) =>
                editingId === c.id ? (
                  <div
                    key={c.id}
                    className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl p-2.5 space-y-1.5 font-mono col-span-1 sm:col-span-2"
                  >
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-sans focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="number"
                        step="0.5"
                        value={editDelta}
                        onChange={(e) => setEditDelta(parseFloat(e.target.value))}
                        className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex items-center justify-end space-x-1.5 font-sans">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="px-2.5 py-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEditing(c.id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                      >
                        Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={c.id}
                    className="group bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl p-2.5 flex items-center justify-between font-mono"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-xs"
                        style={{ backgroundColor: c.color }}
                      ></span>
                      <span className="truncate text-slate-800 dark:text-slate-200 font-medium text-xs font-sans">{c.name}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">
                        ±{c.deltaThreshold || 3}%
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditing(c)}
                        title="Sửa nhóm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        title="Xóa nhóm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Form to add a new category */}
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              + TẠO NHÓM DANH MỤC MỚI
            </div>

            <div className="space-y-1">
              <label className="block text-slate-800 dark:text-slate-200 font-bold">Tên nhóm danh mục</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ví dụ: Tin giả (Fake News), Vi phạm bản quyền"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Mã định danh (id) sẽ được hệ thống tự sinh và giữ nguyên vĩnh viễn — đổi tên ở đây sau này sẽ không làm thay đổi mã đó.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-slate-800 dark:text-slate-200 font-bold">Mô tả chính sách</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả mục đích và tiêu chuẩn nhận diện nhóm này..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-slate-800 dark:text-slate-200 font-bold">Màu hiển thị</label>
                <div className="flex items-center space-x-2.5">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded-lg bg-transparent border border-slate-300 dark:border-slate-600 cursor-pointer"
                  />
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-bold">{color}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-800 dark:text-slate-200 font-bold">Ngưỡng cảnh báo delta (±%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={deltaThreshold}
                  onChange={(e) => setDeltaThreshold(parseFloat(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-mono text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-semibold cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs active-press"
              >
                Tạo nhóm mới
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
