"""处理层"""

from news_push.processors.dedup import DeduplicationProcessor
from news_push.processors.filter import FilterProcessor
from news_push.processors.summarizer import SummarizerProcessor

__all__ = ["DeduplicationProcessor", "FilterProcessor", "SummarizerProcessor"]
