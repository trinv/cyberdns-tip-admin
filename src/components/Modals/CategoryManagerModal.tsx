import React, { useState } from 'react';
import { Tag, Trash2, Edit3 } from 'lucide-react';
import { CategoryInfo } from '../../types';
import { ConfirmModal } from './ConfirmModal';

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

  // Pending delete awaiting confirmation via the shared ConfirmModal —
  // replaces window.confirm(), which renders as an unstyled native browser
  // prompt that can't match the app's theme. Declared here (before the
  // isOpen early return below) so this hook is always called in the same
  // order across renders.
  const [deleteTarget, setDeleteTarget] = useState<CategoryInfo | null>(null);

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

  const handleDelete = (cat: CategoryInfo) => {
    if (!onDeleteCategory) return;
    setDeleteTarget(cat);
  };
  const confirmDelete = () => {
    if (deleteTarget && onDeleteCategory) onDeleteCategory(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-6 fw-bold d-flex align-items-center gap-2">
                <Tag size={16} className="text-primary" />
                <span>Quản lý nhóm danh mục (Categories)</span>
              </h2>
              <button onClick={onClose} className="btn-close" />
            </div>

            <div className="modal-body d-flex flex-column gap-4">
              {/* Current Categories List */}
              <div>
                <div className="text-body-secondary text-uppercase fw-bold mb-2" style={{ fontSize: '0.6875rem', letterSpacing: '.06em' }}>
                  Các nhóm hiện có ({categories.length})
                </div>
                <div className="row g-2" style={{ maxHeight: 208, overflowY: 'auto' }}>
                  {categories.map((c) => (
                    <div className="col-12 col-sm-6" key={c.id}>
                      {editingId === c.id ? (
                        <div className="border border-primary rounded-3 p-2 d-flex flex-column gap-2 font-monospace">
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="form-control form-control-sm font-sans"
                            />
                            <input
                              type="number"
                              step="0.5"
                              value={editDelta}
                              onChange={(e) => setEditDelta(parseFloat(e.target.value))}
                              className="form-control form-control-sm"
                              style={{ width: 64 }}
                            />
                          </div>
                          <div className="d-flex align-items-center justify-content-end gap-2 font-sans">
                            <button type="button" onClick={cancelEditing} className="btn btn-link btn-sm text-decoration-none">Hủy</button>
                            <button type="button" onClick={() => saveEditing(c.id)} className="btn btn-primary btn-sm">Lưu</button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-body-tertiary border rounded-3 p-2 d-flex align-items-center justify-content-between font-monospace">
                          <div className="d-flex align-items-center gap-2 text-truncate">
                            <span className="rounded-circle flex-shrink-0" style={{ width: 10, height: 10, backgroundColor: c.color }} />
                            <span className="text-truncate font-sans small">{c.name}</span>
                          </div>
                          <div className="d-flex align-items-center gap-1 flex-shrink-0">
                            <span className="text-body-secondary fw-bold small">±{c.deltaThreshold || 3}%</span>
                            <button type="button" onClick={() => startEditing(c)} title="Sửa nhóm" className="app-header-icon-btn" style={{ width: 24, height: 24 }}>
                              <Edit3 size={12} />
                            </button>
                            <button type="button" onClick={() => handleDelete(c)} title="Xóa nhóm" className="app-header-icon-btn" style={{ width: 24, height: 24 }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Form to add a new category */}
              <form onSubmit={handleSubmit} className="d-flex flex-column gap-3 pt-3 border-top">
                <div className="text-primary text-uppercase fw-bold" style={{ fontSize: '0.6875rem', letterSpacing: '.06em' }}>
                  + Tạo nhóm danh mục mới
                </div>

                <div>
                  <label className="form-label small fw-bold">Tên nhóm danh mục</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ví dụ: Tin giả (Fake News), Vi phạm bản quyền"
                    className="form-control"
                  />
                  <p className="text-body-secondary small mt-1 mb-0">
                    Mã định danh (id) sẽ được hệ thống tự sinh và giữ nguyên vĩnh viễn — đổi tên ở đây sau này sẽ không làm thay đổi mã đó.
                  </p>
                </div>

                <div>
                  <label className="form-label small fw-bold">Mô tả chính sách</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả mục đích và tiêu chuẩn nhận diện nhóm này..."
                    className="form-control"
                  />
                </div>

                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label small fw-bold">Màu hiển thị</label>
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="form-control form-control-color"
                      />
                      <span className="font-monospace small fw-bold">{color}</span>
                    </div>
                  </div>

                  <div className="col-6">
                    <label className="form-label small fw-bold">Ngưỡng cảnh báo delta (±%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={deltaThreshold}
                      onChange={(e) => setDeltaThreshold(parseFloat(e.target.value))}
                      className="form-control font-monospace"
                    />
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-end gap-2 pt-2 border-top">
                  <button type="button" onClick={onClose} className="btn btn-light border">Đóng</button>
                  <button type="submit" className="btn btn-primary">Tạo nhóm mới</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        tone="danger"
        title="Xoá nhóm danh mục?"
        message={
          deleteTarget
            ? `Xoá nhóm danh mục "${deleteTarget.name}"? Các tên miền đang gắn nhóm này sẽ không tự động bị gỡ.`
            : ''
        }
        confirmLabel="Xoá nhóm"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};
