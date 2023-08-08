import localStorage from "./utils/LocalStorage";
import { DEFAULT_CONFIG } from "./config";
import { User } from "./User";
import { stateManager } from "../state-context";
import { ContentId, assert } from "@bubble-protocol/core";
import { testProviderExists } from "./utils/BubbleUtils";
import { PublicChat } from "./chats/PublicChat";
import { ChatFactory } from "./chats/ChatFactory";
import { ecdsa } from "@bubble-protocol/crypto";
import { Chat } from "./Chat";
import { HushBubbleConnectRelay } from "./requestMonitors/HushBubbleConnectRelay";

const CONSTRUCTION_STATE = {
  closed: 'closed',
  new: 'new',
  contractDeployed: 'contract-deployed',
  open: 'open',
  connecting: 'connecting',
  failed: 'failed'
}

const DEFAULT_SETTINGS = {
  monitorForRequests: true
}

export class Session {

  constructionState = CONSTRUCTION_STATE.closed;
  id;
  deviceKey;
  settings = DEFAULT_SETTINGS;
  conversations = [];


  constructor(chain, wallet, deviceKey) {
    this.chain = chain;
    this.wallet = wallet;
    this.deviceKey = deviceKey;
    this.myId = new User(this.deviceKey.cPublicKey);
    this.id = chain.id+'-default';
    this.joinChat = this.joinChat.bind(this);
    this.createChat = this.createChat.bind(this);
    this.terminateChat = this.terminateChat.bind(this);
  }

  async open() {
    console.trace('opening session', this);
    this.state = CONSTRUCTION_STATE.new;
    return this._loadState()
      .then(exists => {
        if (!exists) {
          const bubbleType = DEFAULT_CONFIG.bubbles.find(b => b.classType === 'PublicChat');
          this._addConversation(new PublicChat(bubbleType.id, DEFAULT_CONFIG.bubbleId, this.myId, this.deviceKey));
          this._saveState();
          return this.conversations[0].initialise();
        }
      })
      .then(() => {
        if (this.settings.monitorForRequests) {
          this.requestMonitor = new HushBubbleConnectRelay(this.deviceKey, this.joinChat.bind(this));
          return this.requestMonitor.monitor();
        }
      })
  }

  async reconnect() {
    this.conversations.map(c => c.reconnect());
    if (this.requestMonitor) this.requestMonitor.reconnect();
  }

  async close() {
    return Promise.all(this.conversations.map(c => c.close()));
  }

  getUserId() { 
    return this.myId 
  }

  async createChat({chain, host, bubbleType, params={}}) {
    assert.isObject(chain, 'chain');
    assert.isNumber(chain.id, 'chain.id');
    assert.isHexString(chain.publicBubble, 'chain.publicBubble');
    assert.isObject(host, 'host');
    assert.isObject(host.chains, 'host.chains');
    assert.isObject(host.chains[chain.id], 'host.chains for chain id '+chain.id);
    assert.isString(host.chains[chain.id].url, 'host.chains[].url');
    assert.isObject(bubbleType, 'bubbleType');
    assert.isObject(bubbleType.sourceCode, 'bubbleType.sourceCode');
    assert.isArray(bubbleType.sourceCode.abi, 'bubbleType.sourceCode.abi');
    assert.isHexString(bubbleType.sourceCode.bin || bubbleType.sourceCode.bytecode, 'bubbleType.sourceCode.bin (or bubbleType.sourceCode.bytecode)');
    assert.isObject(params, 'params');

    console.trace("deploying", bubbleType.classType, "to chain", chain.id, "and provider", host.name);

    // get smart contract constructor parameters
    const terminateKey = new ecdsa.Key().privateKey;
    params.terminateKey = terminateKey;
    const constructorParams = ChatFactory.getParamsAsArray(bubbleType.constructorParams, params);

    // get metadata and initialise the member array
    const metadata = ChatFactory.getParams(bubbleType.metadata, params);
    metadata.members = getMembers(this.myId, metadata);

    console.debug(metadata, metadata.members);

    // test provider exists then deploy encrypted application bubble (application id has access, use application key as encryption key)
    return testProviderExists(chain.id, host.chains[chain.id].url, chain.publicBubble)
      .then(() => {
        if (this.wallet.getChain() !== chain.id) return this.wallet.switchChain(chain.id)
      })
      .then(() => {
        console.trace('deploying chat contract');
        return this.wallet.deploy(bubbleType.sourceCode, constructorParams);
        // return "0xC6509dFdE9c071e13847A98EaA568E698e782c42";
      })
      .then(contractAddress => {
        console.trace('contract deployed with address', contractAddress);
        const bubbleId = new ContentId({
          chain: chain.id,
          contract: contractAddress,
          provider: host.chains[chain.id].url
        });
        const conversation = ChatFactory.constructChat(bubbleType.id, bubbleType.classType, bubbleId, this.myId, this.deviceKey, terminateKey, metadata);
        console.trace('creating off-chain bubble on host', conversation.contentId.provider);
        return conversation.create({
          metadata: metadata,
          options: {silent: true}
        })
        .then(() => {
          console.trace('bubble created with content id', conversation.contentId);
          this._addNewConversation(conversation);
          return conversation;
        })
      })
      .then(conversation => {
        if (conversation.chatType.category === 'one-to-one' && this.requestMonitor) {
          this.requestMonitor.notify(conversation.userManager.users[0].publicKey, conversation.getInvite());
        }
        return conversation.contentId;
      })
  }

  async terminateChat(conversation) {
    const terminateKey = conversation.getTerminateKey();
    return this.wallet.send(conversation.contentId.contract, DEFAULT_CONFIG.bubbles[0].sourceCode.abi, 'terminate', [terminateKey])
      .then(() => conversation.terminate())
      .then(() => this._removeChat(conversation));
  }

  async joinChat(inviteStr) {
    assert.isString(inviteStr, "invite");
    let invite, bubbleId, classType;
    try {
      invite = Chat.parseInvite(inviteStr);
      bubbleId = new ContentId(invite.id);
      classType = invite.t;
    }
    catch(error) {
      console.warn(error);
      return Promise.reject(new Error('Invite is invalid', {cause: error}));
    }
    return this.wallet.getCode(bubbleId.contract)
      .then(code => {
        const codeHash = ecdsa.hash(code);
        console.trace('invite contract hash:', codeHash);
        let bubbleType = DEFAULT_CONFIG.bubbles.find(b => b.id.bytecodeHash === codeHash);
        // if (!bubbleType) bubbleType = DEFAULT_CONFIG.bubbles.find(b => b.classType === classType);
        if (!bubbleType) throw new Error('Chat type is not supported');
        let conversation;
        try {
          conversation = ChatFactory.constructChat(bubbleType.id, classType, bubbleId, this.myId, this.deviceKey);
        }
        catch(error) {
          console.warn(error);
          return Promise.reject(new Error('Invite is invalid', {cause: error}));
        }
        if (this.conversations.find(c => c.id === conversation.id)) return Promise.reject(new Error('You are already a member of this chat'));
        return conversation.join()
          .then(() => {
            this._addNewConversation(conversation);
          });
    })
  }

  manageMembers({chat, addedMembers, removedMembers}) {
    try {
      assert.isInstanceOf(chat, Chat, 'chat');
      assert.isArray(addedMembers, 'addedMembers');
      assert.isArray(removedMembers, 'removedMembers');
      const newMembers = chat.metadata.members.filter(m => !removedMembers.includes(m)).concat(addedMembers);
      console.trace(chat.id, 'setting new members', newMembers);
      return Promise.resolve()
      .then(() => {
        console.trace(chat.id, 'adding new members')
        return addedMembers.length === 0 ? Promise.resolve() : 
          this.wallet.send(
            chat.contentId.contract, 
            chat.chatType.sourceCode.abi,
            chat.chatType.actions.addMembers.method,
            ChatFactory.getParamsAsArray(chat.chatType.actions.addMembers.params, {members: addedMembers})
          )
      })
      .then(() => {
        console.trace(chat.id, 'removing old members')
        return removedMembers.length === 0 ? Promise.resolve() : 
          this.wallet.send(
            chat.contentId.contract, 
            chat.chatType.sourceCode.abi,
            chat.chatType.actions.removeMembers.method,
            ChatFactory.getParamsAsArray(chat.chatType.actions.removeMembers.params, {members: removedMembers})
          )
      })
      .then(() => {
        console.trace(chat.id, "writing new users' metadata files")
        return Promise.all(addedMembers.map(m => chat.userManager.addUser(m.publicKey)));
      })
      .then(() => {
        console.trace(chat.id, "removing old users' metadata files")
        return Promise.all(removedMembers.map(m => chat.userManager.removeUser(m.publicKey, {silent: true})));
      })
      .then(() => {
        console.trace(chat.id, 'saving new metadata to bubble')
        return chat.setMetadata({...chat.metadata, members: newMembers});
      })
    }
    catch(error) {
      return Promise.reject(error);
    }
  }

  leaveChat(chat) {
    return Promise.resolve()
      .then(() => {
        this._removeChat(chat);
      })
  }

  hasConnectionWith(id) {
    try {
      const user = new User(id);
      return 0 <= this.conversations.findIndex(c => c.metadata.title === user.address);
    }
    catch(_) {
      return false;
    }
  }

  _addNewConversation(conversation) {
    if (!conversation.isValid()) throw new Error('chat is invalid');
    else {
      this._addConversation(conversation);
      this._saveState();
      stateManager.dispatch('chats', [...this.conversations])
    }
  }

  _addConversation(conversation) {
    conversation.on('new-message-notification', this._handleNewMessage.bind(this));
    conversation.on('unread-change', this._handleUnreadChange.bind(this));
    conversation.on('terminated', this._handleChatTerminated.bind(this));
    this.conversations.push(conversation);
  }

  _removeChat(conversation) {
    if (!this.conversations.includes(conversation)) return Promise.reject(new Error('no such chat'));
    this.conversations = this.conversations.filter(c => c !== conversation);
    this._saveState();
    stateManager.dispatch('chats', this.conversations)
  }

  _handleNewMessage() {
    this.newMsgCount++;
    stateManager.dispatch('new-message-notification', this.newMsgCount);
  }

  _handleUnreadChange() {
    let unread = 0; 
    this.conversations.forEach(c => { unread += c.unreadMsgs });
    stateManager.dispatch('total-unread', unread);
  }

  _handleChatTerminated(conversation) {
    this.conversations = this.conversations.filter(c => c !== conversation);
    this._saveState();
    stateManager.dispatch('chats', this.conversations);
  }

  _loadState() {
    const json = localStorage.read(this.id);
    if (!json) {
      return Promise.resolve(false);
    }
    else {
      const state = JSON.parse(json);
      this.settings = state.settings || DEFAULT_SETTINGS;
      const promises = [];
      state.conversations.forEach(rawC => {
        console.trace('loaded chat', rawC);
        const valid = this._validateConversation(rawC);
        if (valid) {
          try {
            const conversation = ChatFactory.constructChat(rawC.chatType, rawC.classType, new ContentId(rawC.bubbleId), this.myId, this.deviceKey);
            this._addConversation(conversation);
            const promise = conversation.initialise()
              .then(() => {
                if (!conversation.isValid()) console.warn('conversation', conversation.id, 'is invalid', conversation);
              })
              .catch(error => {
                console.warn('failed to initialise conversation', rawC.id, error);
            });
            promises.push(promise);
          }
          catch(error) {
            console.warn('failed to construct chat', rawC, error)
          }
        }
      })
      if (promises.length > 0) return Promise.all(promises).then(() => true);
      else return Promise.resolve(true);
    }
  }

  _validateConversation(rawC) {
    try {
      new ContentId(rawC.bubbleId);
      if (rawC.id === '84531-0x1287afe7Fe61A9A7e5F846673051b00ecb82379a') return false;
      return true;
    }
    catch(error) { 
      console.warn('saved chat is invalid', rawC, error.message)
      return false;
    }
  }

  _saveState() {
    const state = {
      settings: this.settings,
      conversations: this.conversations.map(c => c.serialize())
    }
    localStorage.write(this.id, JSON.stringify(state));
  }

}


function getMembers(myId, metadata) {
  const members = [myId];
  let found = true;
  let index = 0;
  while(found) {
    if (metadata['member'+index]) members.push(new User(metadata['member'+index]));
    else found = false;
    index++;
  }
  if (assert.isArray(metadata.members)) members.concat(metadata.members.map(m => new User(m)));
  return members.sort().filter((m, i, members) => i===0 || m.id !== members[i-1].id);
}
