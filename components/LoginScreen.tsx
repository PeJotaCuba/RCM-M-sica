
import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (mode: 'guest' | 'admin') => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);

  const handleAdminLogin = () => {
    if (password === 'RCMM26') {
      onLogin('admin');
    } else {
      setError('Contraseña incorrecta');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleAdminLogin();
      }
  };

  const handleUpdate = () => {
    window.open("https://github.com/google/gemini-api-cookbook", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark relative overflow-hidden">
       <div className="absolute inset-0 pointer-events-none colonial-pattern h-full w-full z-0 opacity-10"></div>
       
       <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full overflow-y-auto">
          <div className="w-full max-w-xs flex flex-col items-center space-y-8 my-auto">
             <div className="text-center">
                <div className="w-48 h-48 mx-auto mb-4 relative flex items-center justify-center">
                   {!logoError ? (
                       <img 
                           src="./logo.png" 
                           alt="RCM Música Logo" 
                           className="w-full h-full object-contain drop-shadow-xl animate-fade-in"
                           onError={() => setLogoError(true)}
                       />
                   ) : (
                       <div className="w-full h-full flex flex-col items-center justify-center bg-white/10 rounded-full border-4 border-miel/30">
                           <span className="material-symbols-outlined text-8xl text-primary drop-shadow-md">
                               radio
                           </span>
                       </div>
                   )}
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">RCM Música</h1>
             </div>

             <div className="w-full space-y-4">
               {!showAdminInput ? (
                   <>
                       <button 
                           onClick={() => onLogin('guest')}
                           className="w-full bg-white dark:bg-white/10 hover:bg-gray-50 text-gray-900 dark:text-white border-2 border-gray-200 dark:border-white/20 font-bold py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                       >
                           <span className="material-symbols-outlined">person</span>
                           Ingresar como Usuario
                       </button>
                       <button 
                           onClick={() => setShowAdminInput(true)}
                           className="w-full bg-azul-header text-white font-bold py-4 rounded-xl shadow-lg hover:bg-opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2"
                       >
                           <span className="material-symbols-outlined">admin_panel_settings</span>
                           Ingresar como Administrador
                       </button>
                   </>
               ) : (
                   <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 animate-fade-in">
                       <h3 className="text-center font-bold text-gray-900 dark:text-white mb-4">Acceso Administrativo</h3>
                       <div className="relative mb-4">
                           <input 
                               type={showPassword ? "text" : "password"}
                               placeholder="Contraseña"
                               className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                               value={password}
                               onChange={(e) => {
                                   setPassword(e.target.value);
                                   setError('');
                               }}
                               onKeyDown={handleKeyDown}
                           />
                           <button 
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                           >
                               <span className="material-symbols-outlined text-lg">
                                   {showPassword ? 'visibility_off' : 'visibility'}
                               </span>
                           </button>
                       </div>
                       
                       {error && <p className="text-red-500 text-xs mb-4 text-center">{error}</p>}
                       <div className="flex gap-2">
                           <button 
                               onClick={() => setShowAdminInput(false)}
                               className="flex-1 py-3 text-gray-500 font-bold text-sm"
                           >
                               Cancelar
                           </button>
                           <button 
                               onClick={handleAdminLogin}
                               className="flex-1 py-3 bg-primary text-white rounded-lg font-bold text-sm shadow-md"
                           >
                               Entrar
                           </button>
                       </div>
                   </div>
               )}
             </div>
          </div>
       </div>

       <div className="w-full flex justify-center p-8 z-10 shrink-0 mt-4">
            <button 
                onClick={handleUpdate}
                className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider hover:text-primary transition-colors"
            >
                <span className="material-symbols-outlined text-lg">system_update</span>
                Actualizar Base de Datos (Github)
            </button>
       </div>
    </div>
  );
};

export default LoginScreen;
