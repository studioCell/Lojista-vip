
import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Users, Image as ImageIcon, Headphones, Check } from 'lucide-react';
import { useApp } from '../context';
import { UserRole } from '../types';

const Chat: React.FC = () => {
  const { 
    user, 
    allUsers, 
    communityMessages, 
    supportMessages, 
    activeSupportChatId, 
    setActiveSupportChatId,
    sendCommunityMessage, 
    sendSupportMessage 
  } = useApp();
  
  // Tabs: 'community' or 'support'
  const [activeTab, setActiveTab] = useState<'community' | 'support'>('community');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === UserRole.ADMIN;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [communityMessages, supportMessages, activeTab, activeSupportChatId]);

  // Lista de usuários para o Admin (filtra ele mesmo)
  const userList = isAdmin ? allUsers.filter(u => u.id !== user?.id) : [];

  const handleSend = () => {
    if (inputText.trim() === '') return;
    
    if (activeTab === 'community') {
        sendCommunityMessage(inputText);
    } else {
        // Envia para o suporte
        // Se for admin, precisa ter um chat selecionado
        if (isAdmin && !activeSupportChatId) {
            alert("Selecione um usuário para responder.");
            return;
        }
        sendSupportMessage(inputText);
    }
    setInputText('');
  };

  const handleSendImage = () => {
      // Simulação de upload de imagem
      const imgUrl = `https://picsum.photos/400/300?random=${Date.now()}`;
      if (activeTab === 'community') {
          sendCommunityMessage("Enviou uma imagem", imgUrl);
      } else {
          if (isAdmin && !activeSupportChatId) return;
          sendSupportMessage("Enviou uma imagem", imgUrl);
      }
  };

  // Helper para formatar o horário do Firestore
  const formatTime = (timestamp: any) => {
      if (!timestamp) return '...';
      // Se for objeto Timestamp do Firestore
      if (timestamp.toDate) return timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      // Se for string ou outro formato (fallback)
      return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  // Decide quais mensagens mostrar
  const displayMessages = activeTab === 'community' ? communityMessages : supportMessages;

  // Título e Subtítulo do Header
  let chatTitle = "";
  let chatSubtitle = "";

  if (activeTab === 'community') {
      chatTitle = "Comunidade Lojista VIP";
      chatSubtitle = "Grupo Oficial";
  } else {
      if (isAdmin) {
          const targetUser = allUsers.find(u => u.id === activeSupportChatId);
          chatTitle = targetUser ? targetUser.name : "Selecione um Usuário";
          chatSubtitle = targetUser ? "Atendimento ao Cliente" : "Nenhuma conversa selecionada";
      } else {
          chatTitle = "Suporte Lojista VIP";
          chatSubtitle = "Fale com nossos administradores";
      }
  }

  return (
    <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-64px)] flex rounded-xl border border-gray-800 overflow-hidden bg-dark-surface">
      
      {/* Sidebar (Lista de contatos/chats) */}
      <div className="w-20 md:w-80 border-r border-gray-800 flex flex-col bg-dark-surface">
         <div className="p-4 border-b border-gray-800 hidden md:block">
           <h2 className="font-bold text-white">Canais</h2>
         </div>
         
         <div className="flex-1 overflow-y-auto custom-scrollbar">
            
            {/* Opção 1: Comunidade */}
            <div 
                onClick={() => setActiveTab('community')}
                className={`p-4 flex items-center space-x-3 cursor-pointer border-b border-gray-800/50 transition ${activeTab === 'community' ? 'bg-gray-800 border-l-4 border-l-yellow-500' : 'hover:bg-gray-800/50 border-l-4 border-transparent'}`}
            >
                 <div className="relative">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white shrink-0">
                     <Users size={20} />
                   </div>
                 </div>
                 <div className="hidden md:block flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                       <h3 className="text-sm font-bold text-gray-200 truncate">Comunidade Geral</h3>
                    </div>
                    <p className="text-xs text-gray-500 truncate">Chat público para todos</p>
                 </div>
            </div>

            {/* Separador */}
            <div className="hidden md:flex items-center space-x-2 px-4 py-2 mt-4 text-xs font-bold text-gray-500 uppercase">
                <Headphones size={12} />
                <span>{isAdmin ? 'Atendimentos' : 'Privado'}</span>
            </div>

            {/* Opção 2: Suporte (Lógica diferente para User vs Admin) */}
            {isAdmin ? (
                // ADMIN: Lista todos os usuários
                <>
                    {userList.map((u) => (
                        <div 
                            key={u.id}
                            onClick={() => {
                                setActiveTab('support');
                                setActiveSupportChatId(u.id);
                            }}
                            className={`p-4 flex items-center space-x-3 cursor-pointer border-b border-gray-800/50 transition ${activeTab === 'support' && activeSupportChatId === u.id ? 'bg-gray-800 border-l-4 border-l-yellow-500' : 'hover:bg-gray-800/50 border-l-4 border-transparent'}`}
                        >
                             <div className="relative">
                               <img src={u.avatar} className="w-10 h-10 rounded-full bg-gray-700 object-cover" alt={u.name} />
                             </div>
                             <div className="hidden md:block flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                   <h3 className="text-sm font-bold text-gray-200 truncate">{u.name}</h3>
                                </div>
                                <p className="text-xs text-gray-500 truncate">Clique para abrir chat</p>
                             </div>
                        </div>
                    ))}
                    {userList.length === 0 && (
                        <div className="p-4 text-xs text-gray-500 text-center">Nenhum usuário.</div>
                    )}
                </>
            ) : (
                // USER: Apenas opção de Fale Conosco
                <div 
                    onClick={() => {
                        setActiveTab('support');
                        // Para user comum, o context já sabe o ID dele, mas setamos null no activeSupportChatId pois a logica no context usa user.id
                        // Na verdade, para manter consistência visual, selecionamos
                        setActiveSupportChatId(null); 
                    }}
                    className={`p-4 flex items-center space-x-3 cursor-pointer border-b border-gray-800/50 transition ${activeTab === 'support' ? 'bg-gray-800 border-l-4 border-l-yellow-500' : 'hover:bg-gray-800/50 border-l-4 border-transparent'}`}
                >
                     <div className="relative">
                       <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-black shrink-0">
                         <Headphones size={20} />
                       </div>
                     </div>
                     <div className="hidden md:block flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                           <h3 className="text-sm font-bold text-gray-200 truncate">Suporte / Admin</h3>
                        </div>
                        <p className="text-xs text-gray-500 truncate">Fale com a administração</p>
                     </div>
                </div>
            )}
         </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-black/20 relative">
         
         {/* Header */}
         <div className="p-4 border-b border-gray-800 flex items-center space-x-3 bg-dark-surface">
            {activeTab === 'community' ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white"><Users size={16}/></div>
            ) : (
                <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold">
                    {isAdmin ? <User size={16}/> : <Headphones size={16}/>}
                </div>
            )}
            <div>
                <h3 className="font-bold text-white text-sm">{chatTitle}</h3>
                <p className="text-xs text-gray-400">{chatSubtitle}</p>
            </div>
         </div>

         {/* Messages List */}
         <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
            
            {/* Empty State */}
            {displayMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                    <Headphones size={48} className="mb-2"/>
                    <p className="text-sm">
                        {activeTab === 'support' && isAdmin && !activeSupportChatId 
                            ? "Selecione um usuário para ver as mensagens." 
                            : "Nenhuma mensagem ainda. Inicie a conversa!"}
                    </p>
                </div>
            )}
            
            {/* Messages Map */}
            {displayMessages.map((msg) => {
                const isMine = msg.senderId === user?.id;
                return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        {!isMine && (
                            <img src={msg.senderAvatar || 'https://picsum.photos/50'} className="w-8 h-8 rounded-full mr-2 mt-1 bg-gray-700 object-cover border border-gray-600" title={msg.senderName}/>
                        )}
                        <div className={`max-w-[80%] md:max-w-[60%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                            
                            {/* Nome apenas em chats de grupo e se não for eu */}
                            {!isMine && activeTab === 'community' && (
                                <span className="text-[10px] text-gray-500 mb-1 ml-1">{msg.senderName}</span>
                            )}
                            
                            <div className={`p-3 rounded-xl text-sm shadow-md break-words ${isMine ? 'bg-yellow-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'}`}>
                                {msg.text}
                                {msg.imageUrl && (
                                    <img src={msg.imageUrl} alt="Anexo" className="mt-2 rounded-lg w-full max-h-60 object-cover border border-black/20" />
                                )}
                            </div>
                            
                            <span className="text-[9px] text-gray-600 mt-1 flex items-center gap-1">
                                {formatTime(msg.timestamp)}
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
                 disabled={activeTab === 'support' && isAdmin && !activeSupportChatId}
                 placeholder={activeTab === 'community' ? "Converse com a comunidade..." : "Digite sua mensagem..."}
                 className="flex-1 bg-transparent text-white px-2 py-2 focus:outline-none text-sm placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                 value={inputText}
                 onChange={(e) => setInputText(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               />
               <button 
                 onClick={handleSend}
                 disabled={!inputText.trim()}
                 className={`p-2.5 rounded-full transition transform ${inputText.trim() ? 'bg-yellow-500 text-black hover:scale-105 hover:bg-yellow-400 shadow-lg' : 'bg-gray-800 text-gray-500'}`}
               >
                 <Send size={18} />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Chat;
