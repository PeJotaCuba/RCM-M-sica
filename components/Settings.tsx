
import React, { useState } from 'react';
import { Track, User } from '../types';
import * as XLSX from 'xlsx';

interface SettingsProps {
  tracks: Track[];
  users: User[];
  onAddUser: (u: User) => void;
  onEditUser: (u: User, originalUsername?: string) => void;
  onDeleteUser: (username: string) => void;
  onExportUsers: () => void;
  onImportUsers: (users: User[]) => void;
  currentUser?: User | null;
}

const Settings: React.FC<SettingsProps> = ({ tracks, users, onAddUser, onEditUser, onDeleteUser, onExportUsers, onImportUsers, currentUser }) => {
  // Form State
  const [formData, setFormData] = useState({
      username: '',
      fullName: '',
      phone: '',
      password: '',
      confirmPassword: '',
      uniqueId: '',
      role: 'user' as 'user' | 'director' | 'admin'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [originalUsername, setOriginalUsername] = useState('');

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

  const downloadCreditStats = () => {
      const dataTracks = tracks; 
      if (dataTracks.length === 0) {
          alert("No hay pistas en la base de datos.");
          return;
      }
      
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
          username: '', fullName: '', phone: '', password: '', confirmPassword: '', uniqueId: '', role: 'user'
      });
      setIsEditing(false);
      setShowUserModal(false);
      setOriginalUsername('');
  };

  const handleOpenCreate = () => {
      handleResetForm();
      setShowUserModal(true);
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
      setOriginalUsername(user.username);
      setIsEditing(true);
      setShowUserModal(true);
  };

  const handleSubmitUser = () => {
      if (!formData.username || !formData.password || !formData.fullName) {
          alert("Todos los campos marcados son obligatorios.");
          return;
      }
      if (formData.password !== formData.confirmPassword) {
          alert("Las contraseñas no coinciden.");
          return;
      }

      // Validar duplicados (si es nuevo o si se cambió el nombre de usuario)
      if ((!isEditing || formData.username !== originalUsername) && users.some(u => u.username === formData.username)) {
          alert("El nombre de usuario ya existe.");
          return;
      }

      // Admin logic: If editing, uniqueId persists unless explicitly changed. If new, generate.
      const finalUniqueId = formData.uniqueId.trim() || generateUniqueId(formData.fullName);

      const userObj: User = {
          username: formData.username,
          password: formData.password,
          role: formData.role,
          fullName: formData.fullName,
          phone: formData.phone,
          uniqueId: finalUniqueId
      };

      if (isEditing) {
          onEditUser(userObj, originalUsername);
          alert("Usuario actualizado correctamente.");
      } else {
          onAddUser(userObj);
          alert(`Usuario creado correctamente.`);
      }
      handleResetForm();
  };

  // --- TXT Import Logic ---
  const handleTxtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
          const text = event.target?.result as string;
          if (!text) return;
          
          const lines = text.split('\n');
          const newUsers: User[] = [];
          let current: Partial<User> = { role: 'user' }; // Default role: User
          
          const saveCurrent = () => {
             if (current.username && current.password && current.fullName) {
                 // Check if phone exists or empty string
                 if(!current.phone) current.phone = '';
                 // Generate ID
                 if(!current.uniqueId) current.uniqueId = generateUniqueId(current.fullName);
                 
                 newUsers.push(current as User);
             }
          };

          lines.forEach(line => {
             const l = line.trim();
             if (l.toLowerCase().startsWith('nombre:')) {
                 saveCurrent();
                 current = { role: 'user', fullName: l.substring(7).trim() };
             } else if (l.toLowerCase().startsWith('móvil:') || l.toLowerCase().startsWith('movil:')) {
                 current.phone = l.substring(6).trim();
             } else if (l.toLowerCase().startsWith('usuario:')) {
                 current.username = l.substring(8).trim();
             } else if (l.toLowerCase().startsWith('contraseña:') || l.toLowerCase().startsWith('contrasena:')) {
                 current.password = l.substring(11).trim();
             }
          });
          saveCurrent(); // Save last one

          if (newUsers.length > 0) {
              onImportUsers(newUsers);
          } else {
              alert("No se encontraron usuarios válidos en el archivo. Verifique el formato:\nNombre: ...\nMóvil: ...\nUsuario: ...\nContraseña: ...");
          }
          e.target.value = ''; // Reset input
      };
      reader.readAsText(file);
  };

  const handleShareWhatsApp = (u: User) => {
      if (!u.phone) {
          alert("Este usuario no tiene número de móvil registrado.");
          return;
      }

      const message = `Saludos. Tus credenciales APP-RCM son
Usuario: ${u.username}
Contraseña: ${u.password}

Disfruta de nuestras apps en los siguientes enlaces:

Agenda https://rcmagenda.vercel.app/#/home

Música https://rcm-musica.vercel.app/`;

      const url = `https://wa.me/${u.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const getRoleLabel = (role: string) => {
      if (role === 'admin') return 'Coordinador';
      if (role === 'director') return 'Director';
      return 'Usuario';
  };

  // Check if current logged-in user or admin to prevent deletion
  const canDelete = (u: User) => {
      if (u.username === 'admin') return false;
      if (currentUser && u.username === currentUser.username) return false;
      return true;
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
                    <div className="flex gap-2">
                         <label className="bg-gray-100 text-gray-600 text-[10px] font-bold uppercase px-3 py-1.5 rounded flex items-center gap-1 hover:bg-gray-200 cursor-pointer">
                            <span className="material-symbols-outlined text-xs">upload_file</span>
                            Cargar TXT
                            <input type="file" accept=".txt" onChange={handleTxtUpload} className="hidden" />
                        </label>
                        <button 
                            onClick={onExportUsers}
                            className="bg-azul-header text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-900"
                        >
                            <span className="material-symbols-outlined text-xs">save</span>
                            Guardar DB
                        </button>
                    </div>
                </div>
                
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase">Lista de Usuarios</h4>
                        <button 
                            onClick={handleOpenCreate} 
                            className="text-white bg-primary hover:bg-primary-dark text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            Agregar Usuario Manualmente
                        </button>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {users.map(u => (
                            <div key={u.username} className="flex flex-col p-3 bg-gray-50 dark:bg-white/5 rounded border border-gray-100 dark:border-white/5 gap-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`size-2 rounded-full ${u.role === 'admin' ? 'bg-miel' : (u.role === 'director' ? 'bg-azul-header' : 'bg-green-500')}`}></div>
                                        <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{u.username}</span>
                                        <span className="text-[10px] text-gray-400 uppercase">({getRoleLabel(u.role)})</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleShareWhatsApp(u)} className="text-green-500 hover:text-green-600" title="Enviar credenciales"><span className="material-symbols-outlined text-lg">chat</span></button>
                                        <button onClick={() => handleEditClick(u)} className="text-primary hover:text-primary-dark"><span className="material-symbols-outlined text-lg">edit</span></button>
                                        {canDelete(u) && (
                                            <button onClick={() => onDeleteUser(u.username)} className="text-red-400 hover:text-red-600"><span className="material-symbols-outlined text-lg">delete</span></button>
                                        )}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500 flex flex-wrap gap-4">
                                    <span><span className="font-bold">Nombre:</span> {u.fullName || '---'}</span>
                                    <span><span className="font-bold">Móvil:</span> {u.phone || '---'}</span>
                                    <span><span className="font-bold">Clave:</span> {u.password}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* MODAL USER FORM */}
        {showUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={handleResetForm}>
                <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-white/10 pb-2">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase">{isEditing ? `Editando: ${formData.username}` : 'Crear Nuevo Usuario'}</h4>
                        <button onClick={handleResetForm} className="text-gray-400 hover:text-red-500"><span className="material-symbols-outlined">close</span></button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                             <input placeholder="Nombre Completo *" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm" />
                            <input placeholder="Teléfono" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <input placeholder="Nombre de Usuario (Login) *" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm" />
                            <input placeholder="Firma Digital (Solo Lectura/Admin)" value={formData.uniqueId} onChange={e => setFormData({...formData, uniqueId: e.target.value})} className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm font-mono" />
                        </div>

                        <div className="grid grid-cols-2 gap-3 relative">
                            <input type={showPassword ? "text" : "password"} placeholder="Contraseña *" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm" />
                             <input type={showPassword ? "text" : "password"} placeholder="Confirmar Contraseña *" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="w-full p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm" />
                            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-[-30px] top-2 text-gray-400"><span className="material-symbols-outlined text-sm">{showPassword ? 'visibility_off' : 'visibility'}</span></button>
                        </div>

                        <div className="flex gap-4 items-center mt-2 flex-wrap">
                            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-white/5 px-2 py-1 rounded border border-gray-100 dark:border-white/5">
                                <input type="radio" name="role" checked={formData.role === 'admin'} onChange={() => setFormData({...formData, role: 'admin'})} />
                                <span className="text-xs font-bold text-miel">Coordinador</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-white/5 px-2 py-1 rounded border border-gray-100 dark:border-white/5">
                                <input type="radio" name="role" checked={formData.role === 'director'} onChange={() => setFormData({...formData, role: 'director'})} />
                                <span className="text-xs font-bold text-azul-header dark:text-blue-400">Director</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-white/5 px-2 py-1 rounded border border-gray-100 dark:border-white/5">
                                <input type="radio" name="role" checked={formData.role === 'user'} onChange={() => setFormData({...formData, role: 'user'})} />
                                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Usuario</span>
                            </label>
                        </div>

                        <button onClick={handleSubmitUser} className={`w-full text-white text-sm font-bold py-3 rounded mt-2 shadow-lg ${isEditing ? 'bg-miel hover:bg-yellow-600' : 'bg-azul-header hover:bg-blue-900'}`}>
                            {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Settings;
