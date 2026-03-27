"""敏感信息加密存储"""

import os
from cryptography.fernet import Fernet
from pathlib import Path


class SecureStorage:
    """使用 Fernet 加密存储敏感信息"""

    def __init__(self, encryption_key: str | None = None):
        """
        初始化加密存储

        Args:
            encryption_key: 32 字节的加密密钥，如果为 None 则从环境变量读取
        """
        if encryption_key is None:
            encryption_key = os.environ.get("NEWS_PUSH_ENCRYPTION_KEY")
            if not encryption_key:
                raise ValueError(
                    "NEWS_PUSH_ENCRYPTION_KEY 环境变量未设置。"
                    "请先运行 /news init 初始化配置。"
                )

        # 确保密钥是有效的 Fernet 密钥
        try:
            self.cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
        except Exception as e:
            raise ValueError(f"无效的加密密钥: {e}")

    @staticmethod
    def generate_key() -> str:
        """生成新的加密密钥"""
        return Fernet.generate_key().decode()

    def encrypt(self, plaintext: str) -> str:
        """
        加密文本

        Args:
            plaintext: 明文

        Returns:
            加密后的文本（Base64 编码）
        """
        if not plaintext:
            return ""
        encrypted = self.cipher.encrypt(plaintext.encode())
        return encrypted.decode()

    def decrypt(self, encrypted: str) -> str:
        """
        解密文本

        Args:
            encrypted: 加密的文本

        Returns:
            解密后的明文
        """
        if not encrypted:
            return ""
        try:
            decrypted = self.cipher.decrypt(encrypted.encode())
            return decrypted.decode()
        except Exception as e:
            raise ValueError(f"解密失败: {e}")
