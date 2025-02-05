from telethon import TelegramClient, functions
import os
import random
import asyncio
from dotenv import load_dotenv

# 代理配置
PROXY_LIST = [
    {
        'addr': '31.131.167.47',
        'port': 12324,
        'username': '14a91e96097d5',
        'password': 'e48a23adb8'
    }
]

# 加载环境变量
load_dotenv()

# 从环境变量获取配置
api_id = int(os.getenv('API_ID'))
api_hash = os.getenv('API_HASH')

# 配置
GROUP_USERNAME = 'huahua67890'  # 目标群组用户名
MESSAGE = '强盛集团报道'    # 要发送的消息
SESSIONS_DIR = r'E:\TG-bot\huahua'  # session文件目录

async def process_account(session_file):
    """处理单个账号的加群和发消息"""
    try:
        # 创建客户端实例时添加代理配置
        client = TelegramClient(
            session_file, 
            api_id, 
            api_hash,
            proxy=PROXY
        )
        
        print(f"使用代理: {PROXY['addr']}:{PROXY['port']}")
        await client.connect()
        
        if await client.is_user_authorized():
            me = await client.get_me()
            print(f"\n使用账号 {me.first_name} (@{me.username}) 处理中...")
            
            # 随机延迟5-10秒
            delay = random.uniform(4, 6)
            print(f"等待 {delay:.2f} 秒...")
            await asyncio.sleep(delay)
            
            try:
                # 加入群组
                await client(functions.channels.JoinChannelRequest(GROUP_USERNAME))
                print(f"✓ 成功加入群组: {GROUP_USERNAME}")
                
                # 再次随机延迟5-10秒
                delay = random.uniform(3, 5)
                print(f"等待 {delay:.2f} 秒...")
                await asyncio.sleep(delay)
                
                # 发送消息
                await client.send_message(GROUP_USERNAME, MESSAGE)
                print(f"✓ 成功发送消息: {MESSAGE}")
                
            except Exception as e:
                print(f"✗ 操作失败: {str(e)}")
                
        else:
            print(f"✗ 账号未授权: {session_file}")
            
    except Exception as e:
        print(f"✗ 处理账号时出错: {str(e)}")
        
    finally:
        try:
            await client.disconnect()
        except:
            pass

async def main():
    # 获取所有.session文件
    session_files = [
        os.path.join(SESSIONS_DIR, f[:-8])  # 移除.session后缀
        for f in os.listdir(SESSIONS_DIR)
        if f.endswith('.session')
    ]
    
    print(f"找到 {len(session_files)} 个session文件")
    
    # 依次处理每个账号
    for session_file in session_files:
        await process_account(session_file)
        print("-" * 50)

if __name__ == '__main__':
    asyncio.run(main())