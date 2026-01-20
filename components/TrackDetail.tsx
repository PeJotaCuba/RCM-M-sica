
import React, { useState, useEffect } from 'react';
import { Track, AuthMode } from '../types';

interface TrackDetailProps {
  track: Track;
  authMode: AuthMode;
  onClose: () => void;
  onSearchCredits: () => void;
  onSaveEdit?: (track: Track) => void;
}

const GENRES_LIST = [
    "Afrobeats", "Axé", "Bachata", "Bhangra", "Blues", "Bolero", "Bossa nova", "Canción popular", "Chachachá", 
    "Clásica", "Country", "C-Pop", "Cumbia", "Danzón", "Fado", "Flamenco", "Folk", "Forró", "Funk", "Gospel", 
    "Highlife", "Hip-Hop/Rap", "Indie/Alternativo", "J-Pop", "Jazz", "K-Pop", "Mambo", "Mbaqanga", "Merengue", 
    "Metal", "Música árabe", "Música electrónica", "Música india (clásica)", "Ópera", "Pop", "Punk", 
    "R&B (Rhythm & Blues)", "Raï", "Reggae", "Reguetón", "Rock", "Salsa", "Samba", "Ska", "Soul", "Son", 
    "Tango", "Timba", "Trova", "World Music"
];

const COUNTRIES_LIST = [
    "Afganistán", "Albania", "Alemania", "Andorra", "Angola", "Antigua y Barbuda", "Arabia Saudita", "Argelia", "Argentina", "Armenia", "Australia", "Austria", "Azerbaiyán", "Bahamas", "Bangladés", "Barbados", "Baréin", "Bélgica", "Belice", "Benín", "Bielorrusia", "Birmania", "Bolivia", "Bosnia y Herzegovina", "Botsuana", "Brasil", "Brunéi", "Bulgaria", "Burkina Faso", "Burundi", "Bután", "Cabo Verde", "Camboya", "Camerún", "Canadá", "Catar", "Chad", "Chile", "China", "Chipre", "Ciudad del Vaticano", "Colombia", "Comoras", "Corea del Norte", "Corea del Sur", "Costa de Marfil", "Costa Rica", "Croacia", "Cuba", "Dinamarca", "Dominica", "Ecuador", "Egipto", "El Salvador", "Emiratos Árabes Unidos", "Eritrea", "Eslovaquia", "Eslovenia", "España", "Estados Unidos", "Estonia", "Etiopía", "Filipinas", "Finlandia", "Fiyi", "Francia", "Gabón", "Gambia", "Georgia", "Ghana", "Granada", "Grecia", "Guatemala", "Guyana", "Guinea", "Guinea ecuatorial", "Guinea-Bisáu", "Haití", "Honduras", "Hungría", "India", "Indonesia", "Irak", "Irán", "Irlanda", "Islandia", "Islas Marshall", "Islas Salomón", "Israel", "Italia", "Jamaica", "Japón", "Jordania", "Kazajistán", "Kenia", "Kirguistán", "Kiribati", "Kuwait", "Laos", "Lesoto", "Letonia", "Líbano", "Liberia", "Libia", "Liechtenstein", "Lituania", "Luxemburgo", "Macedonia del Norte", "Madagascar", "Malasia", "Malaui", "Maldivas", "Malí", "Malta", "Marruecos", "Mauricio", "Mauritania", "México", "Micronesia", "Moldavia", "Mónaco", "Mongolia", "Montenegro", "Mozambique", "Namibia", "Nauru", "Nepal", "Nicaragua", "Níger", "Nigeria", "Noruega", "Nueva Zelanda", "Omán", "Países Bajos", "Pakistán", "Palaos", "Panamá", "Papúa Nueva Guinea", "Paraguay", "Perú", "Polonia", "Portugal", "Reino Unido", "República Centroafricana", "República Checa", "República del Congo", "República Democrática del Congo", "República Dominicana", "Ruanda", "Rumanía", "Rusia", "Samoa", "San Cristóbal y Nieves", "San Marino", "San Vicente y las Granadinas", "Santa Lucía", "Santo Tomé y Príncipe", "Senegal", "Serbia", "Seychelles", "Sierra Leona", "Singapur", "Siria", "Somalia", "Sri Lanka", "Suazilandia", "Sudáfrica", "Sudán", "Sudán del Sur", "Suecia", "Suiza", "Surinam", "Tailandia", "Tanzania", "Tayikistán", "Timor Oriental", "Togo", "Tonga", "Trinidad y Tobago", "Túnez", "Turkmenistán", "Turquía", "Tuvalu", "Ucrania", "Uganda", "Uruguay", "Uzbekistán", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Yibuti", "Zambia", "Zimbabue"
];

const TrackDetail: React.FC<TrackDetailProps> = ({ track, authMode, onClose, onSearchCredits, onSaveEdit }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        title: track.metadata.title,
        author: track.metadata.author,
        authorCountry: track.metadata.authorCountry || '',
        performer: track.metadata.performer,
        performerCountry: track.metadata.performerCountry || '',
        genre: track.metadata.genre || '',
        year: track.metadata.year || ''
    });

    // Update editData when track changes
    useEffect(() => {
        setEditData({
            title: track.metadata.title,
            author: track.metadata.author,
            authorCountry: track.metadata.authorCountry || '',
            performer: track.metadata.performer,
            performerCountry: track.metadata.performerCountry || '',
            genre: track.metadata.genre || '',
            year: track.metadata.year || ''
        });
    }, [track]);

    const canEdit = authMode === 'admin' || authMode === 'director';

    const handleSave = () => {
        if (!onSaveEdit) return;
        
        const updatedTrack: Track = {
            ...track,
            metadata: {
                ...track.metadata,
                title: editData.title,
                author: editData.author,
                authorCountry: editData.authorCountry,
                performer: editData.performer,
                performerCountry: editData.performerCountry,
                genre: editData.genre,
                year: editData.year
            }
        };
        
        onSaveEdit(updatedTrack);
        setIsEditing(false);
    };

    return (
        <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm flex justify-end animate-fade-in" onClick={onClose}>
            {/* Datalists for Autocomplete */}
            <datalist id="genres-list">
                {GENRES_LIST.map(g => <option key={g} value={g} />)}
            </datalist>
            <datalist id="countries-list">
                {COUNTRIES_LIST.map(c => <option key={c} value={c} />)}
            </datalist>

            <div className="w-full max-w-md bg-white dark:bg-zinc-900 h-full shadow-2xl overflow-y-auto animate-slide-left" onClick={e => e.stopPropagation()}>
                
                {/* Header Image/Icon */}
                <div className="h-48 bg-gradient-to-br from-azul-header to-black flex items-center justify-center relative">
                    <button onClick={onClose} className="absolute top-4 left-4 text-white/80 hover:text-white bg-black/20 rounded-full p-2">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                    <div className="text-center">
                        <span className="material-symbols-outlined text-8xl text-white/20">music_note</span>
                    </div>
                    {/* Floating Edit Button */}
                    {canEdit && !isEditing && (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="absolute -bottom-6 right-6 size-12 bg-miel text-white rounded-full shadow-lg flex items-center justify-center hover:bg-yellow-600 transition-transform hover:scale-105"
                        >
                            <span className="material-symbols-outlined">edit</span>
                        </button>
                    )}
                </div>

                <div className="p-6 pt-10">
                    {/* Title Section */}
                    <div className="mb-6">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Título</label>
                        {isEditing ? (
                            <input 
                                className="w-full text-2xl font-bold bg-gray-50 dark:bg-white/5 border-b-2 border-primary outline-none text-gray-900 dark:text-white"
                                value={editData.title}
                                onChange={e => setEditData({...editData, title: e.target.value})}
                            />
                        ) : (
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{track.metadata.title || track.filename}</h2>
                        )}
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid gap-6">
                        {/* Author */}
                        <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-2 mb-2 text-primary">
                                <span className="material-symbols-outlined">person_edit</span>
                                <h3 className="font-bold text-sm">Autor / Compositor</h3>
                            </div>
                            {isEditing ? (
                                <div className="space-y-2">
                                    <input 
                                        className="w-full p-2 text-sm border rounded dark:bg-black/20 dark:border-gray-600"
                                        placeholder="Nombre del Autor"
                                        value={editData.author}
                                        onChange={e => setEditData({...editData, author: e.target.value})}
                                    />
                                    <input 
                                        className="w-full p-2 text-xs border rounded dark:bg-black/20 dark:border-gray-600"
                                        placeholder="País de origen"
                                        list="countries-list"
                                        value={editData.authorCountry}
                                        onChange={e => setEditData({...editData, authorCountry: e.target.value})}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <p className="text-gray-800 dark:text-gray-200 font-medium">{track.metadata.author}</p>
                                    {track.metadata.authorCountry && <p className="text-xs text-gray-500">{track.metadata.authorCountry}</p>}
                                </div>
                            )}
                        </div>

                        {/* Performer */}
                        <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-2 mb-2 text-azul-header dark:text-blue-400">
                                <span className="material-symbols-outlined">mic_external_on</span>
                                <h3 className="font-bold text-sm">Intérprete</h3>
                            </div>
                            {isEditing ? (
                                <div className="space-y-2">
                                    <input 
                                        className="w-full p-2 text-sm border rounded dark:bg-black/20 dark:border-gray-600"
                                        placeholder="Nombre del Intérprete"
                                        value={editData.performer}
                                        onChange={e => setEditData({...editData, performer: e.target.value})}
                                    />
                                    <input 
                                        className="w-full p-2 text-xs border rounded dark:bg-black/20 dark:border-gray-600"
                                        placeholder="País de origen"
                                        list="countries-list"
                                        value={editData.performerCountry}
                                        onChange={e => setEditData({...editData, performerCountry: e.target.value})}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <p className="text-gray-800 dark:text-gray-200 font-medium">{track.metadata.performer}</p>
                                    {track.metadata.performerCountry && <p className="text-xs text-gray-500">{track.metadata.performerCountry}</p>}
                                </div>
                            )}
                        </div>

                        {/* Extra Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg border border-gray-100 dark:border-white/10">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Género</label>
                                {isEditing ? (
                                    <input 
                                        className="w-full p-1 text-sm border-b border-gray-300 dark:border-gray-600 bg-transparent outline-none"
                                        list="genres-list"
                                        value={editData.genre}
                                        onChange={e => setEditData({...editData, genre: e.target.value})}
                                    />
                                ) : (
                                    <p className="text-sm font-medium">{track.metadata.genre || '---'}</p>
                                )}
                            </div>
                            <div className="p-3 rounded-lg border border-gray-100 dark:border-white/10">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Año</label>
                                {isEditing ? (
                                    <input 
                                        className="w-full p-1 text-sm border-b border-gray-300 dark:border-gray-600 bg-transparent outline-none"
                                        type="text"
                                        value={editData.year}
                                        onChange={e => setEditData({...editData, year: e.target.value})}
                                    />
                                ) : (
                                    <p className="text-sm font-medium">{track.metadata.year || '---'}</p>
                                )}
                            </div>
                        </div>

                        {/* File Info */}
                        <div className="p-4 bg-gray-100 dark:bg-black/20 rounded-lg text-xs text-gray-500 space-y-1 font-mono">
                            <p><span className="font-bold">Archivo:</span> {track.filename}</p>
                            <p><span className="font-bold">Ruta:</span> {track.path}</p>
                            <p><span className="font-bold">ID:</span> {track.id}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-8 flex gap-3 pb-8">
                        {isEditing ? (
                            <>
                                <button 
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSave}
                                    className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg"
                                >
                                    Guardar Cambios
                                </button>
                            </>
                        ) : (
                           <button 
                                onClick={onSearchCredits}
                                className="w-full bg-azul-header text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl hover:bg-blue-900 transition-colors"
                            >
                                <span className="material-symbols-outlined">smart_toy</span>
                                <span>Consultar IA (Gemini)</span>
                            </button> 
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrackDetail;
