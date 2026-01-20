
import React, { useState } from 'react';

const GUIDE_SECTIONS = [
    {
        title: "Explorador de Música",
        icon: "folder_open",
        content: "Navega por las carpetas de música del servidor (Música 1, 2, 3...). Puedes buscar canciones por título, intérprete o nombre de archivo. Toca una canción para ver sus detalles o una carpeta para abrirla."
    },
    {
        title: "Selección de Temas",
        icon: "checklist",
        content: "Mientras navegas, toca el botón '+' para agregar canciones a tu lista de selección. En la pestaña 'Selección', puedes revisar tu lista, agregar temas faltantes manualmente o buscar por lista de deseos."
    },
    {
        title: "Generación de Reportes",
        icon: "description",
        content: "Una vez tengas tu selección lista, ve a 'Exportar'. El Director puede generar un reporte PDF oficial que se guardará automáticamente en su sesión. Los usuarios pueden exportar a TXT o compartir por WhatsApp."
    },
    {
        title: "Lista de Deseos",
        icon: "list_alt",
        content: "Si tienes una lista de temas en texto (ej. bloc de notas), puedes copiarla y pegarla en la 'Lista de Deseos' dentro de la sección Selección para buscar todos los temas automáticamente."
    },
    {
        title: "Sincronización",
        icon: "sync",
        content: "Usa el botón de actualizar en la parte superior derecha para obtener los últimos cambios en la base de datos de usuarios y la versión de la aplicación."
    }
];

const Guide: React.FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-y-auto pb-24">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-miel">help</span>
                Guía de Usuario
            </h2>
            <div className="space-y-4">
                {GUIDE_SECTIONS.map((section, idx) => (
                    <div key={idx} className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm">
                        <button 
                            onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-azul-header dark:text-blue-400">{section.icon}</span>
                                <span className="font-bold text-gray-800 dark:text-white text-sm text-left">{section.title}</span>
                            </div>
                            <span className="material-symbols-outlined text-gray-400 text-sm transition-transform duration-300" style={{ transform: openIndex === idx ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                        </button>
                        {openIndex === idx && (
                            <div className="p-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-white/5 bg-white dark:bg-zinc-900 animate-fade-in">
                                {section.content}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
                <p className="text-xs text-blue-800 dark:text-blue-300 text-center">
                    <strong>Radio Ciudad Monumento</strong><br/>
                    Sistema de Gestión Musical v2.0
                </p>
            </div>
        </div>
    );
};

export default Guide;
