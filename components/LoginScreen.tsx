
import React, { useState } from 'react';
import { User } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  users: User[];
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, users }) => {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleLoginSubmit();
      }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark relative overflow-hidden">
       <div className="absolute inset-0 pointer-events-none colonial-pattern h-full w-full z-0 opacity-10"></div>
       
       <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full overflow-y-auto">
          <div className="w-full max-w-sm flex flex-col items-center space-y-8 my-auto bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-white/5">
             <div className="text-center">
                <div className="w-32 h-32 mx-auto mb-4 relative flex items-center justify-center">
                   <div className="w-full h-full flex flex-col items-center justify-center bg-white/10 rounded-full border-4 border-miel/30 shadow-lg animate-fade-in">
                       <span className="material-symbols-outlined text-6xl text-primary drop-shadow-md">
                           radio
                       </span>
                   </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">RCM Música</h1>
                <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest font-bold">Acceso al Sistema</p>
             </div>

             <div className="w-full space-y-4">
                 <div>
                     <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Usuario o Teléfono</label>
                     <div className="relative">
                         <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400 text-lg">person</span>
                         <input 
                            type="text"
                            placeholder="Usuario o # Teléfono"
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            value={identifier}
                            onChange={(e) => {
                                setIdentifier(e.target.value);
                                setError('');
                            }}
                         />
                     </div>
                 </div>

                 <div>
                     <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Contraseña</label>
                     <div className="relative">
                         <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400 text-lg">lock</span>
                         <input 
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="w-full pl-10 pr-10 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
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
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 outline-none"
                         >
                            <span className="material-symbols-outlined text-lg">
                                {showPassword ? 'visibility_off' : 'visibility'}
                            </span>
                         </button>
                     </div>
                 </div>
                 
                 {error && <p className="text-red-500 text-xs text-center font-bold bg-red-50 p-2 rounded animate-pulse">{error}</p>}

                 <button 
                     onClick={handleLoginSubmit}
                     className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
                 >
                     <span>Iniciar Sesión</span>
                     <span className="material-symbols-outlined">arrow_forward</span>
                 </button>
             </div>
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
