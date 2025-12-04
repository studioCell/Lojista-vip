
import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Users, Image as ImageIcon, Headphones, Check } from 'lucide-react';
import { useApp } from '../context';
import { UserRole } from '../types';

const Chat: React.FC = () => {
  const { user, allUsers, communityMessages, privateMessages, sendCommunityMessage, sendPrivateMessage } = useApp();
  
  // Channels: 'community' | userId (for private support chat)
  // If User: activeChannel should always be their own ID when chatting with support (or 'support' alias)
  // If Admin: activeChannel is the ID of the user they are talking to.
  const [activeChannel, setActiveChannel] = useState<string>('community'); 
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === UserRole.ADMIN;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [communityMessages, privateMessages, activeChannel]);

  // --- Logic for Sidebar List ---
  
  // For Admin: Show ALL registered users so they can start or continue chats.
  // For User: Show only "Suporte" option.
  const userList = isAdmin 
    ? allUsers.filter(u => u.id !== user?.id) // All users except me (admin)
    : []; // Regular user doesn't see other users in sidebar, just "Support"

  const handleSend = () => {
    if (inputText.trim() === '') return;
    
    if (activeChannel === 'community') {
        sendCommunityMessage(inputText);
    } else {
        // Send Private
        // If Admin: target is the activeChannel (User ID)
        // If User: target is My Own ID (because that's the channel name for support)
        const targetId = isAdmin ? activeChannel : user?.id;
        if(targetId) {
            sendPrivateMessage(inputText, targetId);
        }
    }
    setInputText('');
  };

  const handleSendImage = () => {
      const imgUrl = `https://picsum.photos/400/300?random=${Date.now()}`;
      if (activeChannel === 'community') {
          sendCommunityMessage("Enviou uma imagem", imgUrl);
      } else {
           const targetId = isAdmin ? activeChannel : user?.id;
           if(targetId) {
                sendPrivateMessage("Enviou uma imagem", targetId, imgUrl);
           }
      }
  };

  // --- Filter Messages for View ---
  const displayMessages = activeChannel === 'community' 
    ? communityMessages 
    : privateMessages.filter(m => m.channelId === (isAdmin ? activeChannel : user?.id));

  // Determine current chat header info
  let chatTitle = "Comunidade Lojista VIP";
  let chatSubtitle = "Grupo Oficial";
  let chatAvatar = null;

  if (activeChannel !== 'community') {
      if (isAdmin) {
          const target = allUsers.find(u => u.id === activeChannel);
          chatTitle = target?.name || "Usuário";
          chatSubtitle = "Atendimento ao Cliente";
          chatAvatar = target?.avatar;
      } else {
          chatTitle = "Suporte Lojista VIP";
          chatSubtitle = "Fale com nossos administradores";
      }
  }

  return (
    <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-64px)] flex rounded-xl border border-gray-800 overflow-hidden bg-dark-surface">
      {/* Sidebar List */}
      <div className="w-20 md:w-80 border-r border-gray-800 flex flex-col bg-dark-surface">
         <div className="p-4 border-b border-gray-800 hidden md:block">
           <h2 className="font-bold text-white">Mensagens</h2>
         </div>
         <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Community Channel */}
            <div 
                onClick={() => setActiveChannel('community')}
                className={`p-4 flex items-center space-x-3 cursor-pointer border-b border-gray-800/50 transition ${activeChannel === 'community' ? 'bg-gray-800' : 'hover:bg-gray-800/50'}`}
            >
                 <div className="relative">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white shrink-0">
                     <Users size={20} />
                   </div>
                 </div>
                 <div className="hidden md:block flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                       <h3 className="text-sm font-bold text-gray-200 truncate">Comunidade Lojista</h3>
                    </div>
                    <p className="text-xs text-gray-500 truncate">Grupo Oficial</p>
                 </div>
            </div>

            {/* Separator / Header */}
            <div className="hidden md:flex items-center space-x-2 px-4 py-2 mt-4 text-xs font-bold text-gray-500 uppercase">
                <Headphones size={12} />
                <span>{isAdmin ? 'Atendimentos' : 'Suporte'}</span>
            </div>

            {/* Support Channels */}
            {isAdmin ? (
                // ADMIN VIEW: List of Users
                <>
                    {userList.map((u) => {
                        // Find last message for this user to show preview
                        const lastMsg = privateMessages.filter(m => m.channelId === u.id).pop();
                        
                        return (
                            <div 
                                key={u.id}
                                onClick={() => setActiveChannel(u.id)}
                                className={`p-4 flex items-center space-x-3 cursor-pointer border-b border-gray-800/50 transition ${activeChannel === u.id ? 'bg-gray-800' : 'hover:bg-gray-800/50'}`}
                            >
                                <div className="relative">
                                <img src={u.avatar} className="w-10 h-10 rounded-full bg-gray-700 object-cover" />
                                </div>
                                <div className="hidden md:block flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="text-sm font-bold text-gray-200 truncate">{u.name}</h3>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">
                                        {lastMsg ? lastMsg.text : 'Clique para iniciar conversa'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    {userList.length === 0 && (
                        <div className="p-4 text-xs text-gray-600 text-center italic">
                            Nenhum usuário cadastrado.
                        </div>
                    )}
                </>
            ) : (
                // USER VIEW: Single Support Channel
                <div 
                    onClick={() => setActiveChannel(user?.id || 'support')}
                    className={`p-4 flex items-center space-x-3 cursor-pointer border-b border-gray-800/50 transition ${activeChannel !== 'community' ? 'bg-gray-800' : 'hover:bg-gray-800/50'}`}
                >
                     <div className="relative">
                       <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-black shrink-0">
                         <Headphones size={20} />
                       </div>
                     </div>
                     <div className="hidden md:block flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                           <h3 className="text-sm font-bold text-gray-200 truncate">Fale com o Admin</h3>
                        </div>
                        <p className="text-xs text-gray-500 truncate">Atendimento Privado</p>
                     </div>
                </div>
            )}
         </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-black/20 relative">
         {/* Chat Header */}
         <div className="p-4 border-b border-gray-800 flex items-center space-x-3 bg-dark-surface">
            {activeChannel === 'community' ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white"><Users size={16}/></div>
            ) : (
                chatAvatar ? (
                    <img src={chatAvatar} className="w-8 h-8 rounded-full bg-gray-700 object-cover" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold">
                        {isAdmin ? <User size={16}/> : <Headphones size={16}/>}
                    </div>
                )
            )}
            <div>
                <h3 className="font-bold text-white text-sm">{chatTitle}</h3>
                <p className="text-xs text-gray-400">{chatSubtitle}</p>
            </div>
         </div>

         {/* Messages List */}
         <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
            {displayMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                    <Headphones size={48} className="mb-2"/>
                    <p className="text-sm">Nenhuma mensagem ainda.</p>
                    <p className="text-xs">Inicie a conversa!</p>
                </div>
            )}
            
            {displayMessages.map((msg) => {
                const isMine = msg.senderId === user?.id;
                return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        {!isMine && activeChannel === 'community' && (
                            <img src={msg.senderAvatar || 'https://picsum.photos/50'} className="w-8 h-8 rounded-full mr-2 mt-1 bg-gray-700 object-cover border border-gray-600" title={msg.senderName}/>
                        )}
                        <div className={`max-w-[80%] md:max-w-[60%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                            {!isMine && activeChannel === 'community' && <span className="text-[10px] text-gray-500 mb-1 ml-1">{msg.senderName}</span>}
                            
                            <div className={`p-3 rounded-xl text-sm shadow-md break-words ${isMine ? 'bg-yellow-500 text-black rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'}`}>
                                {msg.text}
                                {msg.imageUrl && (
                                    <img src={msg.imageUrl} alt="Anexo" className="mt-2 rounded-lg w-full max-h-60 object-cover border border-black/10" />
                                )}
                            </div>
                            <span className="text-[9px] text-gray-600 mt-1 flex items-center gap-1">
                                {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                {isMine && <Check size={10} />}
                            </span>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
         </div>

         {/* Input Area */}
         <div className="p-4 bg-dark-surface border-t border-gray-800">
            <div className="flex items-center space-x-2 bg-gray-900/50 p-1.5 rounded-full border border-gray-700">
               <button 
                onClick={handleSendImage}
                title="Enviar Foto (Simulação)"
                className="p-2.5 rounded-full text-gray-400 hover:text-yellow-400 hover:bg-gray-800 transition"
               >
                   <ImageIcon size={20} />
               </button>
               <input 
                 type="text" 
                 placeholder={activeChannel === 'community' ? "Converse com a comunidade..." : "Digite sua mensagem..."}
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
