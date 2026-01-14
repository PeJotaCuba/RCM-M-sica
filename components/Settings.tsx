
import React, { useState } from 'react';
import { Track, User } from '../types';
import * as XLSX from 'xlsx';

interface SettingsProps {
  tracks: Track[];
  users: User[];
  onAddUser: (u: User) => void;
  onDeleteUser: (username: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ tracks, users, onAddUser, onDeleteUser }) => {
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'guest' as 'guest' | 'admin' });
  const [showPassword, setShowPassword] = useState(false);

  // --- STATS DOWNLOAD ---
  const downloadCreditStats = () => {
      const verifiedTracks = tracks.filter(t => t.isVerified);
      if (verifiedTracks.length === 0) {
          alert("No hay pistas verificadas para generar estadísticas.");
          return;
      }

      const data = verifiedTracks.map(t => ({
          Título: t.metadata.title,
          Autor: t.metadata.author,
          Intérprete: t.metadata.performer,
          Álbum: t.metadata.album,
          Género: t.metadata.genre,
          Ruta: t.path
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Créditos Verificados");
      XLSX.writeFile(workbook, "RCM_Estadisticas_Creditos.xlsx");
  };

  // --- USER MANAGEMENT ---
  const handleCreateUser = () => {
      if (!newUser.username || !newUser.password) {
          alert("Usuario y contraseña requeridos.");
          return;
      }
      if (users.some(u => u.username === newUser.username)) {
          alert("El usuario ya existe.");
          return;
      }
      onAddUser(newUser);
      setNewUser({ username: '', password: '', role: 'guest' });
      alert("Usuario creado correctamente.");
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-y-auto pb-24">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Ajustes de Administrador</h2>
        
        <div className="space-y-8">
            
            {/* 1. Statistics */}
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4 text-azul-header dark:text-blue-400">
                    <span className="material-symbols-outlined">bar_chart</span>
                    <h3 className="font-bold">Estadísticas de Créditos</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                    Genera un archivo Excel con todos los temas que tienen créditos verificados en la base de datos actual.
                </p>
                <button 
                    onClick={downloadCreditStats}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                    <span className="material-symbols-outlined">download</span>
                    Descargar Excel
                </button>
            </div>

            {/* 2. User Management */}
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4 text-primary">
                    <span className="material-symbols-outlined">group_add</span>
                    <h3 className="font-bold">Gestión de Usuarios</h3>
                </div>
                
                {/* Create Form */}
                <div className="grid gap-3 mb-6 bg-gray-50 dark:bg-black/20 p-4 rounded-lg">
                    <h4 className="text-xs font-bold text-gray-500 uppercase">Crear Nuevo Usuario</h4>
                    <input 
                        placeholder="Nombre de Usuario" 
                        value={newUser.username}
                        onChange={e => setNewUser({...newUser, username: e.target.value})}
                        className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm"
                    />
                    <div className="relative">
                        <input 
                            type={showPassword ? "text" : "password"}
                            placeholder="Contraseña" 
                            value={newUser.password}
                            onChange={e => setNewUser({...newUser, password: e.target.value})}
                            className="w-full p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm"
                        />
                        <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-gray-400">
                            <span className="material-symbols-outlined text-sm">{showPassword ? 'visibility_off' : 'visibility'}</span>
                        </button>
                    </div>
                    <div className="flex gap-4 items-center mt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="role" checked={newUser.role === 'guest'} onChange={() => setNewUser({...newUser, role: 'guest'})} />
                            <span className="text-sm">Usuario</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="role" checked={newUser.role === 'admin'} onChange={() => setNewUser({...newUser, role: 'admin'})} />
                            <span className="text-sm">Administrador</span>
                        </label>
                    </div>
                    <button onClick={handleCreateUser} className="bg-azul-header text-white text-sm font-bold py-2 rounded mt-2">
                        Crear Usuario
                    </button>
                </div>

                {/* User List */}
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Usuarios Existentes</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {users.map(u => (
                            <div key={u.username} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-white/5 rounded border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-2">
                                    <div className={`size-2 rounded-full ${u.role === 'admin' ? 'bg-miel' : 'bg-green-500'}`}></div>
                                    <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{u.username}</span>
                                    <span className="text-[10px] text-gray-400 uppercase">({u.role === 'guest' ? 'Usuario' : 'Admin'})</span>
                                </div>
                                {u.username !== 'admin' && ( // Prevent deleting main admin if desired, though logic allows it
                                    <button onClick={() => onDeleteUser(u.username)} className="text-red-400 hover:text-red-600">
                                        <span className="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                )}
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
