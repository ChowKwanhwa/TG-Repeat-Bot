#如果是topic，使用flag --topic，并指定topic-id，如python sender.py --topic --topic-id 3

import os
import pandas as pd
from telethon import TelegramClient
import asyncio
import random
from telethon.tl.types import InputPeerChannel, ReactionEmoji
from telethon.tl.functions.messages import GetHistoryRequest, SendReactionRequest
import emoji
from dotenv import load_dotenv
from telethon.tl.functions.channels import JoinChannelRequest
import argparse

# 加载.env文件
load_dotenv()

# 从环境变量获取API凭据
API_ID = os.getenv("API_ID")
API_HASH = os.getenv("API_HASH")

# 其他配置
TARGET_GROUP = "https://t.me/GenesisProtocolOfficial"
TOPIC_ID = 1
SESSIONS_DIR = "genesisday2"
MESSAGES_FILE = "MemeCoreCommunity/MemeCoreCommunity_messages.csv"

# 读取消息数据
df = pd.read_csv(MESSAGES_FILE)
messages = df.to_dict('records')

# 表情符号列表用于reactions
REACTION_EMOJIS = ['👍',  '🔥', '🎉', '🔥']

# 代理列表
PROXY_LIST = [
    {
        'proxy_type': 'socks5',  # 添加代理类型
        'addr': '31.131.167.47',
        'port': 12324,
        'username': '14a91e96097d5',
        'password': 'e48a23adb8'
    }
]

def parse_args():
    parser = argparse.ArgumentParser(description='Telegram message sender')
    parser.add_argument('--topic', action='store_true', 
                       help='Enable topic mode for forum channels')
    parser.add_argument('--topic-id', type=int,
                       help=f'Topic ID for forum channels (default: {TOPIC_ID})')
    parser.add_argument('--loop', action='store_true',
                       help='Enable continuous message sending mode')
    args = parser.parse_args()
    
    # 如果启用了topic模式但没有指定topic-id，使用默认的TOPIC_ID
    if args.topic and args.topic_id is None:
        args.topic_id = TOPIC_ID
        
    return args

async def try_join_group(client, group_url):
    """尝试加入目标群组"""
    try:
        channel = await client.get_entity(group_url)
        # 检查是否已经在群组中
        try:
            participant = await client.get_participants(channel, limit=1)
            print(f"账号已在目标群组中")
            return True
        except Exception:
            print(f"账号未在目标群组中，正在尝试加入...")
            try:
                await client(JoinChannelRequest(channel))
                print(f"成功加入目标群组")
                return True
            except Exception as join_error:
                print(f"加入群组失败: {str(join_error)}")
                return False
    except Exception as e:
        print(f"获取群组信息失败: {str(e)}")
        return False

async def try_connect_with_proxy(session_file, proxy_config):
    """尝试使用特定代理连接并确保加入目标群组"""
    session_path = os.path.join(SESSIONS_DIR, session_file.replace('.session', ''))
    client = TelegramClient(session_path, API_ID, API_HASH, proxy=proxy_config)
    
    try:
        print(f"正在尝试使用代理 {proxy_config['addr']}:{proxy_config['port']} 连接...")
        await client.connect()
        
        if await client.is_user_authorized():
            me = await client.get_me()
            print(f"[成功] 使用代理 {proxy_config['addr']} 连接成功!")
            print(f"       账号: {me.first_name} (@{me.username})")
            
            # 尝试加入目标群组
            if await try_join_group(client, TARGET_GROUP):
                return client
            else:
                await client.disconnect()
                return None
        
        await client.disconnect()
        print(f"[失败] 使用代理 {proxy_config['addr']} 连接失败: 未授权")
        return None
        
    except Exception as e:
        print(f"[失败] 使用代理 {proxy_config['addr']} 连接失败: {str(e)}")
        try:
            await client.disconnect()
        except:
            pass
        return None

async def init_clients():
    """初始化所有客户端，使用代理轮换机制"""
    session_files = [f for f in os.listdir(SESSIONS_DIR) if f.endswith('.session')]
    clients = []
    
    for session_file in session_files:
        client = None
        # 尝试所有代理
        for proxy in PROXY_LIST:
            client = await try_connect_with_proxy(session_file, proxy)
            if client:
                clients.append(client)
                break
        
        if not client:
            print(f"警告: {session_file} 所有代理均连接失败!")
    
    return clients

async def get_recent_messages(client, limit=5, use_topic=False, topic_id=None):
    channel = await client.get_entity(TARGET_GROUP)
    messages = []
    kwargs = {}
    if use_topic:
        kwargs['reply_to'] = topic_id
    print(f"正在获取最近 {limit} 条消息...")
    async for message in client.iter_messages(channel, limit=limit, **kwargs):
        messages.append(message)
        print(f"获取到消息ID: {message.id}")
    messages = messages[::-1]  # 反转消息列表，使最早的消息在前面
    print(f"共获取到 {len(messages)} 条消息")
    return messages

async def process_action(client, message_data, recent_messages, use_topic, topic_id):
    try:
        channel = await client.get_entity(TARGET_GROUP)
        me = await client.get_me()
        username = f"@{me.username}" if me.username else me.id
        
        if not recent_messages:  # 如果没有最近消息，直接发送新消息
            print(f"没有获取到最近消息，直接发送新消息")
            kwargs = {'reply_to': topic_id} if use_topic else {}
            await send_message_by_type(client, channel, message_data, kwargs)
            return

        random_value = random.random()
        print(f"随机值: {random_value:.2f}")
        
        if random_value < 0.15:  # 15% 概率发送表情反应
            target_message = random.choice(recent_messages)
            chosen_emoji = random.choice(REACTION_EMOJIS)
            reaction = [ReactionEmoji(emoticon=chosen_emoji)]
            reaction_text = '点赞' if chosen_emoji == '👍' else f'表情({chosen_emoji})'
            
            await client(SendReactionRequest(
                peer=channel,
                msg_id=target_message.id,
                reaction=reaction
            ))
            print(f"{username} 对消息ID {target_message.id} 进行了{reaction_text}反应")
            
        elif random_value < 0.40:  # 25% 概率回复消息 (0.15 + 0.25 = 0.40)
            target_message = random.choice(recent_messages)
            print(f"{username} 正在回复消息ID {target_message.id}")
            
            try:
                kwargs = {'reply_to': target_message.id}
                await send_message_by_type(client, channel, message_data, kwargs)
                print(f"回复消息成功")
            except Exception as e:
                print(f"回复消息失败: {str(e)}")
                # 如果回复失败，尝试直接发送消息
                kwargs = {'reply_to': topic_id} if use_topic else {}
                await send_message_by_type(client, channel, message_data, kwargs)
                
        else:  # 剩余 60% 概率直接发送消息
            print(f"{username} 直接发送消息")
            kwargs = {'reply_to': topic_id} if use_topic else {}
            await send_message_by_type(client, channel, message_data, kwargs)
                
    except Exception as e:
        print(f"Error processing action: {e}")

async def send_message_by_type(client, channel, message_data, kwargs):
    """根据消息类型发送不同类型的消息"""
    message_type = message_data['message_type']
    print(f"发送 {message_type} 类型的消息")
    
    if message_type == 'text':
        await client.send_message(channel, message_data['message_content'], **kwargs)
    
    elif message_type in ['video', 'photo', 'file']:
        # 从media_path中提取文件路径
        media_path = message_data['media_path'].replace('media/', '')
        full_path = os.path.join("MemeCoreCommunity", "media", media_path)
        print(f"发送媒体文件: {full_path}")
        await client.send_file(channel, full_path, **kwargs)
    
    elif message_type == 'sticker':
        # 从content中提取sticker ID
        sticker_id = message_data['message_content'].split()[1].strip('[]')
        print(f"发送sticker: {sticker_id}")
        # 直接使用sticker ID发送
        try:
            await client.send_file(channel, sticker_id, **kwargs)
        except Exception as e:
            print(f"发送sticker失败: {str(e)}")
    
    else:
        print(f"未知的消息类型: {message_type}")

async def main():
    args = parse_args()
    topic_id = args.topic_id if args.topic else None
    print(f"Using topic mode: {args.topic}, topic ID: {topic_id}")
    print(f"Loop mode: {args.loop}")
    
    # 使用新的初始化方法
    clients = await init_clients()
    
    if not clients:
        print("错误: 没有成功连接的客户端!")
        return
    
    print(f"成功初始化 {len(clients)} 个客户端")
    
    while True:  # 添加无限循环
        # 处理消息发送
        for i in range(0, len(messages), len(clients)):
            # 获取最近的消息
            recent_messages = await get_recent_messages(clients[0], limit=5, 
                                                      use_topic=args.topic, 
                                                      topic_id=topic_id)
            
            batch_messages = messages[i:i + len(clients)]
            if not batch_messages:
                break
                
            available_clients = clients.copy()
            random.shuffle(available_clients)
            
            for msg, client in zip(batch_messages, available_clients):
                await process_action(client, msg, recent_messages, args.topic, topic_id)
                wait_time = random.uniform(5, 60)
                print(f"等待 {wait_time:.1f} 秒后发送下一条消息...")
                await asyncio.sleep(wait_time)
        
        if not args.loop:  # 如果不是循环模式，跳出循环
            break
        print("所有消息发送完成，开始新一轮发送...")
        await asyncio.sleep(1)  # 在重新开始前稍作暂停
    
    # 关闭所有客户端
    for client in clients:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())