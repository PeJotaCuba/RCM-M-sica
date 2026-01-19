
import React, { useState } from 'react';
import { Track, User } from '../types';
import * as XLSX from 'xlsx';

interface SettingsProps {
  tracks: Track[];
  users: User[];
  onAddUser: (u: User) => void;
  onEditUser: (u: User) => void;
  onDeleteUser: (username: string) => void;
  onExportUsers: () => void;
}

const Settings: React.FC<SettingsProps> = ({ tracks, users, onAddUser, onEditUser, onDeleteUser, onExportUsers }) => {
  // Form State
  const [formData, setFormData] = useState({
      username: '',
      fullName: '',
      phone: '',
      password: '',
      confirmPassword: '',
      uniqueId: '',
      role: 'guest' as 'guest' | 'admin'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Helper to generate Unique ID (> 20 chars)
  const generateUniqueId = (name: string) => {
      const cleanName = name ? name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 10) : 'USR';
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let random = '';
      for (let i = 0; i < 16; i++) {
          random += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `RCM-${cleanName}-${random}`;
  };

  // Helper to generate Auto Password
  // Format: RadioCiudad + UserIndex + YearLast2Digits
  const generateAutoPassword = () => {
      const yearSuffix = new Date().getFullYear().toString().slice(-2);
      // We use users.length + 1 for the ID logic, ensuring it grows.
      const userId = users.length + 1;
      return `RadioCiudad${userId}${yearSuffix}`;
  };

  const downloadCreditStats = () => {
      const dataTracks = tracks; 
      if (dataTracks.length === 0) {
          alert("No hay pistas en la base de datos.");
          return;
      }
      // ... (Resto del código de estadísticas igual que antes) ...
      const totalTracks = dataTracks.length;
      const countUnique = (field: keyof typeof dataTracks[0]['metadata']) => {
          const s = new Set<string>();
          dataTracks.forEach(t => { if (t.metadata[field] && t.metadata[field] !== 'Desconocido') s.add(t.metadata[field] as string); });
          return s.size;
      };
      const totalAuthors = countUnique('author');
      const totalPerformers = countUnique('performer');
      const getDistribution = (field: keyof typeof dataTracks[0]['metadata']) => {
          const counts: Record<string, number> = {};
          dataTracks.forEach(t => {
              const val = (t.metadata[field] as string) || 'Sin Especificar';
              counts[val] = (counts[val] || 0) + 1;
          });
          return Object.entries(counts).sort((a,b) => b[1] - a[1]);
      };

      const genres = getDistribution('genre');
      const authorCountries = getDistribution('authorCountry');
      const performerCountries = getDistribution('performerCountry');

      const sheet1Rows: any[] = [];
      sheet1Rows.push(["REPORTE GENERAL DE ESTADÍSTICAS RCM"]);
      sheet1Rows.push([""]);
      sheet1Rows.push(["TOTALES"]);
      sheet1Rows.push(["Cantidad de Temas Musicales", totalTracks]);
      sheet1Rows.push(["Cantidad de Autores Únicos", totalAuthors]);
      sheet1Rows.push(["Cantidad de Intérpretes Únicos", totalPerformers]);
      sheet1Rows.push([""]);
      
      const addSection = (title: string, data: [string, number][], header1: string) => {
          sheet1Rows.push([title]);
          sheet1Rows.push([header1, "Cantidad"]);
          data.forEach(([key, val]) => sheet1Rows.push([key, val]));
          sheet1Rows.push([""]);
      };
      addSection("GÉNEROS MUSICALES", genres, "Género");
      addSection("PAÍSES DE AUTORES", authorCountries, "País");
      addSection("PAÍSES DE INTÉRPRETES", performerCountries, "País");

      const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
      const detailData = dataTracks.map(t => ({
          Título: t.metadata.title,
          Autor: t.metadata.author,
          Intérprete: t.metadata.performer,
          Ruta: t.path
      }));
      const ws2 = XLSX.utils.json_to_sheet(detailData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, ws1, "Estadísticas");
      XLSX.utils.book_append_sheet(workbook, ws2, "Detalle de Temas");
      XLSX.writeFile(workbook, "RCM_Reporte_Completo.xlsx");
  };

  const handleResetForm = () => {
      setFormData({
          username: '', fullName: '', phone: '', password: '', confirmPassword: '', uniqueId: '', role: 'guest'
      });
      setIsEditing(false);
  };

  const handleEditClick = (user: User) => {
      setFormData({
          username: user.username,
          fullName: user.fullName || '',
          phone: user.phone || '',
          password: user.password,
          confirmPassword: user.password,
          uniqueId: user.uniqueId || '',
          role: user.role
      });
      setIsEditing(true);
  };

  const handleSubmitUser = () => {
      // Auto-generate password if empty and creating new
      let finalPassword = formData.password;
      if (!isEditing && !finalPassword) {
          finalPassword = generateAutoPassword();
          // Also set confirm so validation passes if we were to check, but we skip validation for auto
      } else {
          // Validation only if manual entry
           if (!formData.username || !finalPassword || !formData.fullName) {
              alert("Todos los campos marcados son obligatorios.");
              return;
          }
          if (finalPassword !== formData.confirmPassword) {
              alert("Las contraseñas no coinciden.");
              return;
          }
      }

      if (!isEditing && users.some(u => u.username === formData.username)) {
          alert("El nombre de usuario ya existe.");
          return;
      }

      const finalUniqueId = formData.uniqueId.trim() || generateUniqueId(formData.fullName);

      const userObj: User = {
          username: formData.username,
          password: finalPassword,
          role: formData.role,
          fullName: formData.fullName,
          phone: formData.phone,
          uniqueId: finalUniqueId
      };

      if (isEditing) {
          onEditUser(userObj);
          alert("Usuario actualizado correctamente.");
      } else {
          onAddUser(userObj);
          alert(`Usuario creado correctamente.\nContraseña Generada: ${finalPassword}`);
      }
      handleResetForm();
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-y-auto pb-24">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Ajustes de Administrador</h2>
        
        <div className="space-y-8">
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4 text-azul-header dark:text-blue-400">
                    <span className="material-symbols-outlined">bar_chart</span>
                    <h3 className="font-bold">Base de Datos (Excel)</h3>
                </div>
                <button 
                    onClick={downloadCreditStats}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                    <span className="material-symbols-outlined">download</span>
                    Descargar Reporte Completo
                </button>
            </div>

            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4 justify-between">
                    <div className="flex items-center gap-3 text-primary">
                        <span className="material-symbols-outlined">manage_accounts</span>
                        <h3 className="font-bold">Gestión de Usuarios</h3>
                    </div>
                    <button 
                        onClick={onExportUsers}
                        className="bg-azul-header text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-900"
                    >
                        <span className="material-symbols-outlined text-xs">save</span>
                        Guardar DB
                    </button>
                </div>
                
                <div className="grid gap-3 mb-6 bg-gray-50 dark:bg-black/20 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase">{isEditing ? `Editando: ${formData.username}` : 'Crear Nuevo Usuario'}</h4>
                        {isEditing && <button onClick={handleResetForm} className="text-xs text-red-500 font-bold hover:underline">Cancelar</button>}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                         <input placeholder="Nombre Completo *" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm" />
                        <input placeholder="Teléfono" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Nombre de Usuario (Login) *" value={formData.username} disabled={isEditing} onChange={e => setFormData({...formData, username: e.target.value})} className={`p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm ${isEditing ? 'opacity-50' : ''}`} />
                        <input placeholder="Firma Digital (Auto si vacío)" value={formData.uniqueId} onChange={e => setFormData({...formData, uniqueId: e.target.value})} className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm font-mono" />
                    </div>

                    {!isEditing && <p className="text-[10px] text-gray-400 mt-1">Nota: Si deja la contraseña vacía, se generará automáticamente (RadioCiudad + # + Año).</p>}
                    <div className="grid grid-cols-2 gap-3 relative">
                        <input type={showPassword ? "text" : "password"} placeholder="Contraseña *" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm" />
                         <input type={showPassword ? "text" : "password"} placeholder="Confirmar Contraseña *" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="w-full p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm" />
                        <button onClick={() => setShowPassword(!showPassword)} className="absolute right-[-30px] top-2 text-gray-400"><span className="material-symbols-outlined text-sm">{showPassword ? 'visibility_off' : 'visibility'}</span></button>
                    </div>

                    <div className="flex gap-4 items-center mt-1">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="role" checked={formData.role === 'guest'} onChange={() => setFormData({...formData, role: 'guest'})} /><span className="text-sm">Usuario</span></label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="role" checked={formData.role === 'admin'} onChange={() => setFormData({...formData, role: 'admin'})} /><span className="text-sm">Administrador</span></label>
                    </div>

                    <button onClick={handleSubmitUser} className={`text-white text-sm font-bold py-2 rounded mt-2 ${isEditing ? 'bg-miel hover:bg-yellow-600' : 'bg-azul-header hover:bg-blue-900'}`}>
                        {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
                    </button>
                </div>

                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Lista de Usuarios</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {users.map(u => (
                            <div key={u.username} className="flex flex-col p-3 bg-gray-50 dark:bg-white/5 rounded border border-gray-100 dark:border-white/5 gap-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`size-2 rounded-full ${u.role === 'admin' ? 'bg-miel' : 'bg-green-500'}`}></div>
                                        <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{u.username}</span>
                                        <span className="text-[10px] text-gray-400 uppercase">({u.role === 'guest' ? 'Usuario' : 'Admin'})</span>
                                    </div>
                                    <div className="flex gap-2">
                                         <button onClick={() => handleEditClick(u)} className="text-primary hover:text-primary-dark"><span className="material-symbols-outlined text-lg">edit</span></button>
                                        <button onClick={() => onDeleteUser(u.username)} className="text-red-400 hover:text-red-600"><span className="material-symbols-outlined text-lg">delete</span></button>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500 flex flex-wrap gap-4">
                                    <span><span className="font-bold">Nombre:</span> {u.fullName || '---'}</span>
                                    <span><span className="font-bold">ID:</span> {u.uniqueId || '---'}</span>
                                    <span><span className="font-bold">Clave:</span> {u.password}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Settings;
