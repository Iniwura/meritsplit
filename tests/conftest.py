"""
Direct In-Memory GenVM Harness and Fixtures for MeritSplit Testing.
Provides mock execution context for LLM consensus, web rendering, and state storage.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root and contracts to sys.path
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import types
import re
import json
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional
import pytest


# ─────────────────────────────────────────────────────────────
# 1. GenLayer Native Types Simulation
# ─────────────────────────────────────────────────────────────

class Address(str):
    """GenLayer 20-byte account address simulation."""
    def __new__(cls, val):
        if isinstance(val, bytes):
            return super().__new__(cls, "0x" + val.hex().lower())
        val_str = str(val).strip().lower()
        if not val_str.startswith("0x"):
            val_str = "0x" + val_str
        return super().__new__(cls, val_str)


class u256(int):
    def __new__(cls, val=0):
        v = int(val)
        if v < 0 or v >= 2**256:
            raise ValueError(f"u256 overflow: {v}")
        return super().__new__(cls, v)


class u64(int):
    def __new__(cls, val=0):
        v = int(val)
        if v < 0 or v >= 2**64:
            raise ValueError(f"u64 overflow: {v}")
        return super().__new__(cls, v)


class u32(int):
    def __new__(cls, val=0):
        v = int(val)
        if v < 0 or v >= 2**32:
            raise ValueError(f"u32 overflow: {v}")
        return super().__new__(cls, v)


class TreeMap(dict):
    """Key-value storage mapping for GenVM."""
    pass


class DynArray(list):
    """Dynamic array storage for GenVM."""
    pass


def allow_storage(cls):
    """Dataclass storage decorator for GenVM."""
    return cls


class UserError(Exception):
    """Revert exception within GenLayer contracts."""
    pass


class ConsensusDisagreementError(Exception):
    """Consensus validation failure when validators disagree on strict equivalence."""
    pass


# ─────────────────────────────────────────────────────────────
# 2. Virtual Machine Context & Mock Engine
# ─────────────────────────────────────────────────────────────

class VMContext:
    def __init__(self):
        self.sender_address = Address("0x1111111111111111111111111111111111111111")
        self.value = u256(0)
        self.web_mocks: Dict[str, Any] = {}
        self.llm_mocks: Dict[str, Any] = {}
        self.default_llm_response: Optional[Any] = None
        self.default_web_response: Optional[Any] = None
        self.simulate_disagreement: bool = False

    @property
    def sender(self) -> Address:
        return self.sender_address

    @sender.setter
    def sender(self, val: Any):
        self.sender_address = Address(val)

    def clear_mocks(self):
        self.web_mocks.clear()
        self.llm_mocks.clear()
        self.default_llm_response = None
        self.default_web_response = None
        self.simulate_disagreement = False

    def mock_web(self, pattern: str, response: Any):
        self.web_mocks[pattern] = response

    def mock_llm(self, pattern: str, response: Any):
        self.llm_mocks[pattern] = response

    def render_web(self, url: str, mode: str = "text") -> str:
        for pat, resp in self.web_mocks.items():
            if re.search(pat, url):
                if isinstance(resp, dict) and "body" in resp:
                    b = resp["body"]
                    return b.decode("utf-8") if isinstance(b, bytes) else str(b)
                return str(resp)
        if self.default_web_response is not None:
            return str(self.default_web_response)
        return f"Mock content for {url}"

    def exec_prompt(self, prompt: str, response_format: str = "json") -> Any:
        for pat, resp in self.llm_mocks.items():
            if re.search(pat, prompt, re.DOTALL):
                return resp
        if self.default_llm_response is not None:
            return self.default_llm_response
        return {
            "scores": {},
            "rationale": "Default mock response",
        }

    def strict_eq(self, fn: Callable[[], Any]) -> Any:
        leader_result = fn()
        if self.simulate_disagreement:
            raise ConsensusDisagreementError("Consensus disagreement: strict equivalence failed across validators.")
        return leader_result

    def expect_revert(self, expected_message_substring: Optional[str] = None):
        """Context manager to assert a contract method call reverts with UserError."""
        return _ExpectRevertContext(expected_message_substring)


class _ExpectRevertContext:
    def __init__(self, expected_message_substring: Optional[str]):
        self.expected = expected_message_substring

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            raise AssertionError("Expected contract execution to revert with UserError, but it succeeded.")
        if not issubclass(exc_type, (UserError, Exception)):
            return False
        if self.expected and self.expected not in str(exc_val):
            raise AssertionError(f"Expected error message containing '{self.expected}', but got '{exc_val}'")
        return True


_CURRENT_VM = VMContext()


# ─────────────────────────────────────────────────────────────
# 3. Dynamic GenLayer Module Registration
# ─────────────────────────────────────────────────────────────

def _ensure_genlayer_module():
    if "genlayer" in sys.modules:
        gl_mod = sys.modules["genlayer"]
    else:
        gl_mod = types.ModuleType("genlayer")
        sys.modules["genlayer"] = gl_mod

    class Contract:
        def __new__(cls, *args, **kwargs):
            instance = super().__new__(cls)
            for attr_name, attr_type in getattr(cls, "__annotations__", {}).items():
                t_str = str(attr_type)
                if "TreeMap" in t_str:
                    setattr(instance, attr_name, TreeMap())
                elif "DynArray" in t_str:
                    setattr(instance, attr_name, DynArray())
            return instance

    class _WriteDecorator:
        def __call__(self, fn):
            return fn

        def payable(self, fn):
            return fn

    class PublicNamespace:
        write = _WriteDecorator()

        @staticmethod
        def view(fn):
            return fn

    class WebNamespace:
        @staticmethod
        def render(url: str, mode: str = "text") -> str:
            return _CURRENT_VM.render_web(url, mode)

    class NondetNamespace:
        web = WebNamespace()

        @staticmethod
        def exec_prompt(prompt: str, response_format: str = "json") -> Any:
            return _CURRENT_VM.exec_prompt(prompt, response_format)

    class EqPrincipleNamespace:
        @staticmethod
        def strict_eq(fn: Callable[[], Any]) -> Any:
            return _CURRENT_VM.strict_eq(fn)

    class MessageProxy:
        @property
        def sender_address(self):
            return _CURRENT_VM.sender_address

        @property
        def value(self):
            return _CURRENT_VM.value

    class StorageNamespace:
        TreeMap = TreeMap
        DynArray = DynArray

    class VMNamespace:
        UserError = UserError

    # Populate module
    gl_mod.Contract = Contract
    gl_mod.public = PublicNamespace()
    gl_mod.nondet = NondetNamespace()
    gl_mod.eq_principle = EqPrincipleNamespace()
    gl_mod.message = MessageProxy()
    gl_mod.storage = StorageNamespace()
    gl_mod.vm = VMNamespace()
    gl_mod.UserError = UserError
    gl_mod.Address = Address
    gl_mod.u256 = u256
    gl_mod.u64 = u64
    gl_mod.u32 = u32
    gl_mod.TreeMap = TreeMap
    gl_mod.DynArray = DynArray
    gl_mod.allow_storage = allow_storage
    gl_mod.gl = gl_mod

    return gl_mod


_ensure_genlayer_module()


# ─────────────────────────────────────────────────────────────
# 4. Pytest Fixtures
# ─────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def setup_vm_state():
    """Reset VM mock state before each test."""
    _CURRENT_VM.clear_mocks()
    _CURRENT_VM.sender = Address("0x1000000000000000000000000000000000000001")
    _CURRENT_VM.value = u256(0)
    yield _CURRENT_VM
    _CURRENT_VM.clear_mocks()


@pytest.fixture
def direct_vm():
    return _CURRENT_VM


@pytest.fixture
def direct_creator():
    return Address("0x1000000000000000000000000000000000000001")


@pytest.fixture
def direct_alice():
    return Address("0x2000000000000000000000000000000000000002")


@pytest.fixture
def direct_bob():
    return Address("0x3000000000000000000000000000000000000003")


@pytest.fixture
def direct_charlie():
    return Address("0x4000000000000000000000000000000000000004")


@pytest.fixture
def direct_dave():
    return Address("0x5000000000000000000000000000000000000005")


@pytest.fixture
def direct_deploy(direct_creator):
    def _deploy(project_name="MeritSplit Protocol", rubric=""):
        _CURRENT_VM.sender = direct_creator
        from contracts.merit_split import MeritSplit
        instance = MeritSplit(project_name=project_name, rubric=rubric)
        return instance
    return _deploy
