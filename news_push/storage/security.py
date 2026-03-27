"""加密存储 - 敏感数据加密"""

import os
from cryptography.fernet import Fernet


class SecureStorage:
    """安全存储 - 加密敏感数据"""

    def __init__(self, encryption_key: str | None = None):
        """
        初始化加密存储

        Args:
            encryption_key: 加密密钥（base64编码）。如果为None，从环境变量NEWS_PUSH_ENCRYPTION_KEY读取
        """
        if encryption_key is None:
            encryption_key = os.getenv("NEWS_PUSH_ENCRYPTION_KEY")

        if encryption_key is None:
            raise ValueError(
                "encryption_key must be provided or set in NEWS_PUSH_ENCRYPTION_KEY environment variable"
            )

        self.cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)

    @staticmethod
    def generate_key() -> str:
        """
        生成新的加密密钥

        Returns:
            Base64编码的加密密钥
        """
        return Fernet.generate_key().decode()

    def encrypt(self, plaintext: str) -> str:
        """
        加密明文

        Args:
            plaintext: 明文字符串

        Returns:
            加密后的字符串（base64编码）
        """
        if not plaintext:
            return ""
        encrypted = self.cipher.encrypt(plaintext.encode())
        return encrypted.decode()

    def decrypt(self, encrypted: str) -> str:
        """
        解密密文

        Args:
            encrypted: 加密的字符串（base64编码）

        Returns:
            解密后的明文字符串
        """
        if not encrypted:
            return ""
        decrypted = self.cipher.decrypt(encrypted.encode())
        return decrypted.decode()
