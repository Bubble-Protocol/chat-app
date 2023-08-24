import * as oneToOneChatSourceCode from "../contracts/OneToOneBubble.json";
import * as publicChatSourceCode from "../contracts/PublicBubble.json";
import * as publicEventChatSourceCode from "../contracts/PublicEventBubble.json";
import * as groupChatSourceCode from "../contracts/GroupBubble.json";
import * as erc721ChatSourceCode from "../contracts/ERC721Bubble.json";
import * as erc1155ChatSourceCode from "../contracts/ERC1155Bubble.json";
import * as friendtechSourceCode from "../contracts/FriendTechBubble.json";
import simpleChatIcon from "../../assets/img/users.png";
import globeIcon from "../../assets/img/globe.png";
import groupIcon from "../../assets/img/group.png";
import publicEventIcon from "../../assets/img/volume.png";
import nftIcon from "../../assets/img/nft.png";
import friendtechIcon from "../../assets/img/friendtech.png";


export const DEFAULT_BUBBLES = [
  {
    title: "Public Chat", // Original HushBubble Public Chat (cannot construct)
    description: "Anyone can join", 
    details: "Unencrypted public chat with no restrictions.\n\nNote, public chats are owned by the wallet that creates them, so until the wallet connectivity feature is released all users will have full control, including the power to delete the chat.", 
    id: {category: 'original-hushbubble-public-chat', bytecodeHash: '629fcda48da3757fb83407ab90325b6170f44b8727efdc4b836712f1a7a1921f'}, 
    classType: 'PublicChat', 
    sourceCode: publicChatSourceCode.default, 
    constructorParams: [], 
    metadata: {title: 'title', icon: 'icon'},
    actions: {
      canConstruct: false,
      canDelete: false
    },
    icon: simpleChatIcon
  },
  {
    title: "One-to-One Chat", 
    description: "Encrypted chat between two people", 
    details: "Two person, end-to-end encrypted chat. No-one, not even HushBubble, can read your messages.", 
    id: {category: 'one-to-one', bytecodeHash: '6a50777810fb784389b557b9058fd0d5eea28466d0711fca6a31a36252a356e9'}, 
    classType: 'OneToOneChat', 
    sourceCode: oneToOneChatSourceCode.default, 
    constructorParams: ['member0.account', 'member1.account', 'terminateToken'],
    metadata: {member0: 'member0.id', member1: 'member1.id'},
    actions: {
      canConstruct: true,
      canLeave: false,
    },
    icon: simpleChatIcon
  },
  {
    title: "Private Group Chat", 
    description: "End-to-end encrypted group chat where everyone is equal", 
    details: "End-to-end encrypted group chat where all members have the same permissions and any member can add and remove others. All but one members must leave the group before it can be deleted. No-one, not even HushBubble, can read your messages.", 
    id: {category: 'group', bytecodeHash: 'eca0e2dbb39f268cfff4c54f90d8c0d3e8e69aa731e7deee941cd08b47345d3b'},
    classType: 'PrivateChat', 
    sourceCode: groupChatSourceCode.default, 
    constructorParams: ['members.account', 'terminateToken'], 
    metadata: {title: 'title', icon: 'icon'},
    actions: {
      canConstruct: true,
      addMembers: {method: 'setUsers', params: ['members.account', 'true']},
      removeMembers: {method: 'setUsers', params: ['members.account', 'false']},
    },
    icon: groupIcon
  },
  {
    title: "Public Chat", 
    description: "Anyone can join", 
    details: "Unencrypted public chat with no restrictions.\n\nNote, public chats are owned by the wallet that creates them, so until the wallet connectivity feature is released all users will have full control, including the power to delete the chat.", 
    id: {category: 'public', bytecodeHash: '1cc04f1670339fb356fae402c8b20a69ec585d90526d4798a30d793102e2d776'}, 
    classType: 'PublicChat', 
    sourceCode: publicChatSourceCode.default, 
    constructorParams: [], 
    metadata: {title: 'title', icon: 'icon'},
    actions: {
      canConstruct: true,
    },
    icon: globeIcon
  },
  {
    title: "Public Event", 
    description: "Group chat with public read", 
    details: "Unencrypted public chat with write permission limited to users you grant access.", 
    id: {category: 'public', bytecodeHash: '41ef5d0a546851b6277619540ba5bf19629374d1157dfde59c84518013b7724d'}, 
    classType: 'PublicChat', 
    sourceCode: publicEventChatSourceCode.default, 
    constructorParams: ['members.account'], 
    metadata: {title: 'title', icon: 'icon'},
    actions: {
      canConstruct: true,
      addMembers: {method: 'setUsers', params: ['members.account', 'true']},
      removeMembers: {method: 'setUsers', params: ['members.account', 'false']},
      canWrite: {method: 'isUser', params: ['my.checksum-account']}
    },
    icon: publicEventIcon
  },
  {
    title: "friend.tech Chat", 
    description: "Chat with your friend.tech key holders", 
    details: "Only friend.tech key holders with one or more or your keys can access the chat. You MUST be logged in to HushBubble with your friend.tech account.", 
    id: {category: 'public', bytecodeHash: '928726f9072f58097631fc0d852b6666b48559406f9637cd0374e4f5af714f17'}, 
    classType: 'PublicChat', 
    sourceCode: friendtechSourceCode.default, 
    constructorParams: [], 
    metadata: {title: 'title', icon: 'icon'},
    actions: {
      canConstruct: true,
      canDelete: {method: 'canDelete', params: ['my.account']},
    },
    icon: friendtechIcon,
    limitToChains: [8453]
  },
  {
    title: "NFT Chat (ERC721)", 
    description: "Chat with other NFT owners", 
    details: "Only owners of the specified ERC721 contract can access the chat.", 
    id: {category: 'public', bytecodeHash: '82529b8fe9aab266baedd7be8feb501bfa1aa0f954411c23dff1884bf1d5cd43'}, 
    classType: 'PublicChat', 
    sourceCode: erc721ChatSourceCode.default, 
    constructorParams: [
      {id: 'nft-contract', type: 'address', title: 'NFT Contract', subtitle: 'The ERC721 contract that controls the members of this chat'}, 
      'my.address'
    ], 
    metadata: {title: 'title', icon: 'icon'},
    actions: {
      requiresDelegate: true,
      canConstruct: true,
      canDelete: {method: 'canDelete', params: ['my.account']},
    },
    icon: nftIcon
  },
  {
    title: "NFT Chat (ERC1155)", 
    description: "Chat with other NFT owners", 
    details: "Only owners of the specified ERC1155 contract and token ID can access the chat.", 
    id: {category: 'public', bytecodeHash: '39bef1777deb3dfb14f64b9f81ced092c501fee72f90e93d03bb95ee89df9837'}, 
    classType: 'PublicChat', 
    sourceCode: erc1155ChatSourceCode.default, 
    constructorParams: [
      {id: 'nft-contract', type: 'address', title: 'NFT Contract', subtitle: 'The ERC1155 contract that controls the members of this chat'}, 
      {id: 'nft-id', type: 'uint256', title: 'NFT ID', subtitle: 'The ID of the token within the ERC1155 contract'}, 
      'my.account'
    ], 
    metadata: {title: 'title', icon: 'icon'},
    actions: {
      requiresDelegate: true,
      canConstruct: true,
      canDelete: {method: 'canDelete', params: ['my.account']},
    },
    icon: nftIcon
  },
  {id: {category: 'group', bytecodeHash: ''}, title: "Moderated Group Chat", description: "Group chat with admin controls", classType: 'PrivateChat', sourceCode: groupChatSourceCode.default, actions: {canConstruct: true}, disabled: true},
  {id: {category: 'custom', bytecodeHash: ''}, title: "Custom Chat", description: "Your chat, your rules", sourceCode: groupChatSourceCode.default, actions: {canConstruct: true}, disabled: true},
]