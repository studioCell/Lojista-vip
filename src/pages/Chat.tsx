
import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Users, Image as ImageIcon, Search, MessageSquare } from 'lucide-react';
import { useApp } from '../context';
import { UserRole } from '../types';

const Chat: React.FC = () => {
  const { user, allUsers, communityMessages, privateMessages, sendCommunityMessage, sendPrivateMessage } = useApp();
  
  // 'community' or a 'user_id' (to chat with)
  const [activeChatTarget, setActiveChatTarget] = useState<string>('community'); 
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [communityMessages, privateMessages, activeChatTarget]);

  // --- LOGIC: Filter Users for Sidebar ---
  // Exclude self. Filter by search.
  const filteredUsers = allUsers.filter(u => 
      u.id !== user?.id && 
      u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- LOGIC: Get Messages for Active Chat ---
  const getDisplayMessages = () => {
      if (activeChatTarget === 'community') {
          return communityMessages;
      } else {
          // Calculate the channel ID for P2P chat: [myId, targetId].sort().join('_')
          const myId = user?.id || '';
          const targetId = activeChatTarget;
          const channelId = [myId, targetId].sort().join('_');
          
          return privateMessages.filter(m => m.channelId === channelId);
      }
  };

  const displayMessages = getDisplayMessages();

  // --- HANDLERS ---
  const handleSend = () => {
    if (inputText.trim() === '') return;
    
    if (activeChatTarget === 'community') {
        sendCommunityMessage(inputText);
    } else {
        // Send directly to the target user ID. 
        // Context handles generating the shared channel ID.
        sendPrivateMessage(inputText, activeChatTarget);
    }
    setInputText('');
  };

  const handleSendImage = () => {
      // Simulation of image upload
      const imgUrl = `https://picsum.photos/400/300?random=${Date.now()}`;
      if (activeChatTarget === 'community') {
          sendCommunityMessage("Enviou uma imagem", imgUrl);
      } else {
           sendPrivateMessage("Enviou uma imagem", activeChatTarget, imgUrl);
      }
  };

  // Find info about the current chat target
  const targetUser = allUsers.find(u => u.id === activeChatTarget);

  return (
    <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-64px)] flex rounded-xl border border-gray-800 overflow-hidden bg-dark-surface animate-fade-in">
      
      {/* LEFT SIDEBAR: Contact List */}
      <div className="w-24 md:w-80 border-r border-gray-800 flex flex-col bg-gray-900/50">
         
         {/* Search Header */}
         <div className="p-4 border-b border-gray-800">
            <h2 className="font-bold text-white mb-3 hidden md:block">Conversas</h2>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar..." 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-yellow-500 outline-none hidden md:block"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <div className="md:hidden flex justify-center">
                    <Search className="text-gray-400" size={20} />
                </div>
            </div>
         </div>

         {/* List */}
         <div className="flex-1 overflow-y-auto custom-scrollbar">
            
            {/* Community Option */}
            <div 
                onClick={() => setActiveChatTarget('community')}
                className={`p-4 flex items-center space-x-3 cursor-pointer border-b border-gray-800/50 transition hover:bg-gray-800 ${activeChatTarget === 'community' ? 'bg-gray-800 border-l-4 border-l-yellow-500' : ''}`}
            >
                 <div className="relative shrink-0">
                   <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white">
                     <Users size={24} />
                   </div>
                 </div>
                 <div className="hidden md:block flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                       <h3 className="text-sm font-bold text-white truncate">Comunidade Global</h3>
                    </div>
                    <p className="text-xs text-gray-400 truncate">Grupo Oficial Lojista VIP</p>
                 </div>
            </div>

            {/* User List */}
            {filteredUsers.map(u => {
                // Determine user label styling
                const isAdmin = u.role === UserRole.ADMIN;
                
                return (
                    <div 
                        key={u.id}
                        onClick={() => setActiveChatTarget(u.id)}
                        className={`p-4 flex items-center space-x-3 cursor-pointer border-b border-gray-800/50 transition hover:bg-gray-800 ${activeChatTarget === u.id ? 'bg-gray-800 border-l-4 border-l-yellow-500' : ''}`}
                    >
                        <div className="relative shrink-0">
                            <img src={u.avatar} className="w-12 h-12 rounded-full bg-gray-700 object-cover" alt={u.name} />
                            {isAdmin && (
                                <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-[8px] font-bold px-1 rounded">ADM</div>
                            )}
                        </div>
                        <div className="hidden md:block flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-1">
                                <h3 className={`text-sm font-bold truncate ${isAdmin ? 'text-yellow-400' : 'text-gray-200'}`}>
                                    {u.name}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                                {isAdmin ? 'Suporte Oficial' : 'Lojista Membro'}
                            </p>
                        </div>
                    </div>
                );
            })}

            {filteredUsers.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-xs mt-4">
                    Nenhum usuário encontrado.
                </div>
            )}
         </div>
      </div>

      {/* RIGHT SIDE: Chat Window */}
      <div className="flex-1 flex flex-col bg-black/20 relative">
         
         {/* Header */}
         <div className="p-4 border-b border-gray-800 flex items-center space-x-4 bg-dark-surface z-10 shadow-sm">
            {activeChatTarget === 'community' ? (
                <>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-lg">
                        <Users size={20}/>
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Comunidade Lojista VIP</h3>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Online agora
                        </p>
                    </div>
                </>
            ) : targetUser ? (
                <>
                    <img src={targetUser.avatar} className="w-10 h-10 rounded-full bg-gray-700 border border-gray-600" />
                    <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                            {targetUser.name}
                            {targetUser.role === UserRole.ADMIN && <span className="text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                        </h3>
                        <p className="text-xs text-gray-400">
                            {targetUser.role === UserRole.ADMIN ? 'Atendimento Suporte' : 'Lojista Parceiro'}
                        </p>
                    </div>
                </>
            ) : (
                <div className="text-white">Selecione uma conversa</div>
            )}
         </div>

         {/* Messages Area */}
         <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar bg-repeat" style={{ backgroundImage: 'radial-gradient(#1f2937 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            {displayMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-70">
                    <MessageSquare size={64} className="mb-4 text-gray-700"/>
                    <p className="text-sm">Nenhuma mensagem ainda.</p>
                    <p className="text-xs">Envie um "Olá" para começar!</p>
                </div>
            )}
            
            {displayMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    {!msg.isMine && (activeChatTarget === 'community') && (
                        <img 
                            src={msg.senderAvatar || 'https://picsum.photos/50'} 
                            className="w-8 h-8 rounded-full mr-2 mt-1 bg-gray-700 object-cover border border-gray-600 shadow-sm" 
                            alt={msg.senderName}
                            title={msg.senderName}
                        />
                    )}
                    
                    <div className={`max-w-[80%] md:max-w-[60%] flex flex-col ${msg.isMine ? 'items-end' : 'items-start'}`}>
                        {/* Name only in community chat for others */}
                        {!msg.isMine && activeChatTarget === 'community' && (
                            <span className="text-[10px] text-gray-400 mb-1 ml-1 font-bold">{msg.senderName}</span>
                        )}
                        
                        <div className={`p-3 rounded-2xl text-sm shadow-md ${
                            msg.isMine 
                                ? 'bg-yellow-500 text-black rounded-tr-none' 
                                : 'bg-gray-800 text-gray-100 rounded-tl-none border border-gray-700'
                        }`}>
                            {msg.text}
                            {msg.imageUrl && (
                                <img src={msg.imageUrl} alt="Anexo" className="mt-2 rounded-lg w-full max-h-60 object-cover border border-black/10" />
                            )}
                        </div>
                        <span className="text-[9px] text-gray-500 mt-1 px-1 opacity-70">{msg.timestamp}</span>
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
         </div>

         {/* Input Area */}
         <div className="p-4 bg-dark-surface border-t border-gray-800">
            <div className="flex items-center space-x-3 bg-gray-900/50 p-1.5 rounded-full border border-gray-700">
               <button 
                onClick={handleSendImage}
                title="Enviar Foto (Simulação)"
                className="p-2.5 rounded-full text-gray-400 hover:text-yellow-400 hover:bg-gray-800 transition"
               >
                   <ImageIcon size={20} />
               </button>
               
               <input 
                 type="text" 
                 placeholder="Digite sua mensagem..."
                 className="flex-1 bg-transparent text-white px-2 py-2 focus:outline-none text-sm placeholder-gray-500"
                 value={inputText}
                 onChange={(e) => setInputText(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               />
               
               <button 
                 onClick={handleSend}
                 disabled={!inputText.trim()}
                 className={`p-2.5 rounded-full transition transform ${inputText.trim() ? 'bg-yellow-500 text-black hover:scale-105 hover:bg-yellow-400 shadow-lg' : 'bg-gray-800 text-gray-500'}`}
               >
                 <Send size={18} className={inputText.trim() ? 'ml-0.5' : ''} />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Chat;
