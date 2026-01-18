
import React, { useState } from 'react';
import { User } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  users: User[];
  onUpdateUsers: () => void;
  isUpdating: boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, users, onUpdateUsers, isUpdating }) => {
  const [identifier, setIdentifier] = useState(''); // Can be username or phone
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = () => {
    if (!identifier || !password) {
        setError("Por favor ingrese credenciales");
        return;
    }

    const user = users.find(u => 
        (u.username === identifier || u.phone === identifier) && 
        u.password === password
    );
    
    if (user) {
        onLoginSuccess(user);
    } else {
        setError("Usuario o Contraseña incorrectos");
        setPassword('');
    }
  };

  const handleGuestAccess = () => {
      // Create a temporary guest user
      const guestUser: User = {
          username: 'invitado',
          password: '',
          role: 'guest',
          fullName: 'Invitado',
          phone: '',
          uniqueId: `GUEST-${Date.now()}` // Temporary session ID
      };
      onLoginSuccess(guestUser);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleLoginSubmit();
      }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark relative overflow-hidden">
       <div className="absolute inset-0 pointer-events-none colonial-pattern h-full w-full z-0 opacity-10"></div>
       
       <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full overflow-y-auto">
          <div className="w-full max-w-sm flex flex-col items-center space-y-6 my-auto bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-white/5">
             <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 relative flex items-center justify-center">
                   <div className="w-full h-full flex flex-col items-center justify-center bg-white/10 rounded-full border-4 border-miel/30 shadow-lg animate-fade-in">
                       <span className="material-symbols-outlined text-5xl text-primary drop-shadow-md">
                           radio
                       </span>
                   </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">RCM Música</h1>
             </div>

             {/* ACCESO INVITADO (Principal) */}
             <div className="w-full">
                 <button 
                     onClick={handleGuestAccess}
                     className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2 group"
                 >
                     <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">public</span>
                     <span className="text-lg">Entrar como Invitado</span>
                 </button>
                 <p className="text-center text-[10px] text-gray-400 mt-2">Acceso limitado de solo lectura y búsqueda</p>
             </div>

             <div className="relative flex py-2 items-center w-full">
                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-[10px] uppercase font-bold">Acceso Administrativo</span>
                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
             </div>

             {/* ACCESO ADMIN (Secundario) */}
             <div className="w-full space-y-3 bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                 <div>
                     <div className="relative">
                         <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">person</span>
                         <input 
                            type="text"
                            placeholder="Usuario Admin"
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-600 focus:border-azul-header focus:ring-1 focus:ring-azul-header outline-none transition-all text-sm"
                            value={identifier}
                            onChange={(e) => {
                                setIdentifier(e.target.value);
                                setError('');
                            }}
                         />
                     </div>
                 </div>

                 <div>
                     <div className="relative">
                         <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">lock</span>
                         <input 
                            type={showPassword ? "text" : "password"}
                            placeholder="Contraseña"
                            className="w-full pl-9 pr-9 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-600 focus:border-azul-header focus:ring-1 focus:ring-azul-header outline-none transition-all text-sm"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError('');
                            }}
                            onKeyDown={handleKeyDown}
                         />
                         <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 outline-none"
                         >
                            <span className="material-symbols-outlined text-lg">
                                {showPassword ? 'visibility_off' : 'visibility'}
                            </span>
                         </button>
                     </div>
                 </div>
                 
                 {error && <p className="text-red-500 text-[10px] text-center font-bold bg-red-50 p-1 rounded animate-pulse">{error}</p>}

                 <button 
                     onClick={handleLoginSubmit}
                     className="w-full bg-azul-header hover:bg-opacity-90 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2"
                 >
                     <span>Entrar como Admin</span>
                 </button>
             </div>

             {/* Sync Button (Solo visible si es necesario, o movido abajo) */}
             <button 
                 onClick={onUpdateUsers}
                 disabled={isUpdating}
                 className="text-[10px] text-gray-400 hover:text-azul-cauto flex items-center gap-1 transition-colors"
             >
                 <span className={`material-symbols-outlined text-sm ${isUpdating ? 'animate-spin' : ''}`}>sync</span>
                 <span>{isUpdating ? 'Sincronizando...' : 'Sincronizar usuarios'}</span>
             </button>
          </div>
       </div>

       {/* Footer / Disclaimer */}
       <div className="p-4 text-center text-[10px] text-gray-400 font-medium">
            Radio Ciudad Monumento &copy; {new Date().getFullYear()}
       </div>
    </div>
  );
};

export default LoginScreen;
