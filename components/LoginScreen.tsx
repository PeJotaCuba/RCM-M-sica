
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
        setError("Por favor ingrese sus credenciales");
        return;
    }

    const user = users.find(u => 
        (u.username.toLowerCase() === identifier.toLowerCase() || u.phone === identifier) && 
        u.password === password
    );
    
    if (user) {
        onLoginSuccess(user);
    } else {
        setError("Usuario o Contraseña incorrectos");
        setPassword('');
    }
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
             
             {/* Logo / Icon Header */}
             <div className="flex flex-col items-center mb-2">
                <div className="size-32 mb-4 relative hover:scale-105 transition-transform duration-500">
                    <img 
                        src="/icons/logo.png" 
                        alt="CMNL Música Logo" 
                        className="w-full h-full object-contain drop-shadow-xl"
                    />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">CMNL MÚSICA</h1>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Acceso Restringido</p>
             </div>

             {/* FORMULARIO DE ACCESO */}
             <div className="w-full space-y-4">
                 <div>
                     <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Usuario</label>
                     <div className="relative">
                         <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">person</span>
                         <input 
                            type="text"
                            placeholder="Nombre de usuario"
                            className="w-full pl-9 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 focus:border-azul-header focus:ring-1 focus:ring-azul-header outline-none transition-all text-sm"
                            value={identifier}
                            onChange={(e) => {
                                setIdentifier(e.target.value);
                                setError('');
                            }}
                            onKeyDown={handleKeyDown}
                         />
                     </div>
                 </div>

                 <div>
                     <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Contraseña</label>
                     <div className="relative">
                         <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">lock</span>
                         <input 
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="w-full pl-9 pr-9 py-3 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 focus:border-azul-header focus:ring-1 focus:ring-azul-header outline-none transition-all text-sm"
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
                 
                 {error && (
                    <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg justify-center animate-pulse">
                        <span className="material-symbols-outlined text-sm">error</span>
                        <p className="text-[10px] font-bold">{error}</p>
                    </div>
                 )}

                 <button 
                     onClick={handleLoginSubmit}
                     className="w-full bg-azul-header hover:bg-opacity-90 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
                 >
                     <span>Iniciar Sesión</span>
                     <span className="material-symbols-outlined text-lg">login</span>
                 </button>
             </div>

             <div className="pt-4 border-t border-gray-100 dark:border-white/5 w-full flex justify-center">
                 <button 
                     onClick={onUpdateUsers}
                     disabled={isUpdating}
                     className="text-[10px] text-gray-400 hover:text-azul-cauto flex items-center gap-1.5 transition-colors"
                 >
                     <span className={`material-symbols-outlined text-base ${isUpdating ? 'animate-spin' : ''}`}>sync</span>
                     <span>{isUpdating ? 'Actualizando base de datos...' : 'Sincronizar usuarios'}</span>
                 </button>
             </div>
          </div>
       </div>

       {/* Footer */}
       <div className="p-4 text-center text-[10px] text-gray-400 font-medium">
            Radio Ciudad Monumento &copy; {new Date().getFullYear()}
       </div>
    </div>
  );
};

export default LoginScreen;
