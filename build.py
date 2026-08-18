import json
import shutil
import sys
import zipfile
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any

CONFIG_FILE = "package.json"
sys.dont_write_bytecode = True

class ConfigError(Exception):
	pass

class BuildError(Exception):
	pass

@dataclass(frozen=True)
class FileEntry:
	source: Path
	target: Path
	label: str

@dataclass(frozen=True)
class Target:
	name: str
	output: Path
	manifest: Path
	bundle: Path | None
	use_common: bool
	files: tuple[FileEntry, ...]

@dataclass(frozen=True)
class BuildPlan:
	source: Path
	output: Path
	common: tuple[FileEntry, ...]
	targets: tuple[Target, ...]

@dataclass(frozen=True)
class Artifact:
	target: str
	output: Path
	bundle: Path | None

class PackageSchema(ABC):

	@abstractmethod
	def list_actions(self) -> list[str]:
		raise NotImplementedError

	@abstractmethod
	def describe_actions(self) -> list[tuple[str, list[str]]]:
		raise NotImplementedError

	@abstractmethod
	def plan(self, action: str) -> BuildPlan:
		raise NotImplementedError

class PackageSchemaV1(PackageSchema):

	def __init__(self, root: Path, config: dict[str, Any]) -> None:
		self.root = root
		self.config = config
		self._require_object(config, "config")
		self._validate_top_level()

	def list_actions(self) -> list[str]:
		return [name for name, _targets in self._actions()]

	def describe_actions(self) -> list[tuple[str, list[str]]]:
		return self._actions()

	def plan(self, action: str) -> BuildPlan:
		action_map = dict(self._actions())
		if action not in action_map:
			raise ConfigError(f"Unknown action: {action}")
		source = self._resolve_under(self.root, self.config["source"], "source")
		output = self._resolve_under(self.root, self.config["output"], "output")
		common = self._parse_file_entries(self.config.get("common", []), "common")
		targets: list[Target] = []
		for target_name in action_map[action]:
			target_config = self.config["targets"][target_name]
			targets.append(self._parse_target(target_name, target_config))
		return BuildPlan(
			source=source,
			output=output,
			common=tuple(common),
			targets=tuple(targets),
		)

	def _validate_top_level(self) -> None:
		if self.config.get("schema") != 1:
			raise ConfigError("Unsupported schema. Expected schema: 1")
		for key in ("source", "output", "actions", "targets"):
			if key not in self.config:
				raise ConfigError(f"Missing required field: {key}")
		self._require_string(self.config["source"], "source")
		self._require_string(self.config["output"], "output")
		self._require_list(self.config["actions"], "actions")
		self._require_object(self.config["targets"], "targets")
		if "common" in self.config:
			self._require_list(self.config["common"], "common")
		action_names = set()
		for index, action in enumerate(self.config["actions"]):
			label = f"actions[{index}]"
			self._require_list(action, label)
			if len(action) != 2:
				raise ConfigError(f"{label} must contain exactly two items")
			name, targets = action
			self._require_string(name, f"{label}[0]")
			self._require_list(targets, f"{label}[1]")
			if name in action_names:
				raise ConfigError(f"Duplicate action name: {name}")
			action_names.add(name)
			for target in targets:
				self._require_string(target, f"{label}[1]")
				if target not in self.config["targets"]:
					raise ConfigError(f"Action {name} references missing target: {target}")
		for target_name, target_config in self.config["targets"].items():
			self._require_string(target_name, "target name")
			self._validate_target(target_name, target_config)

	def _actions(self) -> list[tuple[str, list[str]]]:
		return [(action[0], list(action[1])) for action in self.config["actions"]]

	def _validate_target(self, name: str, target: Any) -> None:
		self._require_object(target, f"targets.{name}")
		for key in ("output", "manifest"):
			if key not in target:
				raise ConfigError(f"Missing required field: targets.{name}.{key}")
		self._require_string(target["output"], f"targets.{name}.output")
		self._require_string(target["manifest"], f"targets.{name}.manifest")
		if "bundle" in target:
			self._require_string(target["bundle"], f"targets.{name}.bundle")
		if "common" in target and not isinstance(target["common"], bool):
			raise ConfigError(f"targets.{name}.common must be true or false")
		if "files" in target:
			self._require_list(target["files"], f"targets.{name}.files")

	def _parse_target(self, name: str, target: dict[str, Any]) -> Target:
		target_output = self._relative_path(target["output"], f"targets.{name}.output")
		manifest = self._relative_path(target["manifest"], f"targets.{name}.manifest")
		bundle = None
		if "bundle" in target:
			bundle = self._relative_path(target["bundle"], f"targets.{name}.bundle")
		return Target(
			name=name,
			output=target_output,
			manifest=manifest,
			bundle=bundle,
			use_common=target.get("common", True),
			files=tuple(self._parse_file_entries(target.get("files", []), f"targets.{name}.files")),
		)

	def _parse_file_entries(self, entries: list[Any], label: str) -> list[FileEntry]:
		parsed: list[FileEntry] = []
		seen: dict[Path, Path] = {}
		for index, entry in enumerate(entries):
			entry_label = f"{label}[{index}]"
			if isinstance(entry, str):
				source = self._relative_path(entry, entry_label)
				target = source
			elif isinstance(entry, list) and len(entry) == 2:
				self._require_string(entry[0], f"{entry_label}[0]")
				self._require_string(entry[1], f"{entry_label}[1]")
				source = self._relative_path(entry[0], f"{entry_label}[0]")
				target = self._relative_path(entry[1], f"{entry_label}[1]")
			else:
				raise ConfigError(f"{entry_label} must be a string or a two-item string array")
			if target in seen and seen[target] != source:
				raise ConfigError(f"{entry_label} writes to an already used target path: {target}")
			seen[target] = source
			parsed.append(FileEntry(source=source, target=target, label=entry_label))
		return parsed

	def _relative_path(self, value: str, label: str) -> Path:
		path = Path(value)
		if path.is_absolute():
			raise ConfigError(f"{label} must be a relative path")
		if any(part == ".." for part in path.parts):
			raise ConfigError(f"{label} must not contain '..'")
		if not path.parts:
			raise ConfigError(f"{label} must not be empty")
		return path

	def _resolve_under(self, base: Path, value: str, label: str) -> Path:
		rel = self._relative_path(value, label)
		resolved = (base / rel).resolve()
		base_resolved = base.resolve()
		if not self._is_relative_to(resolved, base_resolved):
			raise ConfigError(f"{label} escapes the project directory")
		return resolved

	@staticmethod
	def _is_relative_to(path: Path, base: Path) -> bool:
		try:
			path.relative_to(base)
			return True
		except ValueError:
			return False

	@staticmethod
	def _require_string(value: Any, label: str) -> None:
		if not isinstance(value, str) or value == "":
			raise ConfigError(f"{label} must be a non-empty string")

	@staticmethod
	def _require_list(value: Any, label: str) -> None:
		if not isinstance(value, list):
			raise ConfigError(f"{label} must be a list")

	@staticmethod
	def _require_object(value: Any, label: str) -> None:
		if not isinstance(value, dict):
			raise ConfigError(f"{label} must be an object")

SCHEMAS = {
	1: PackageSchemaV1,
}

class PackageBuilder:

	def __init__(self, root: Path, schema: PackageSchema) -> None:
		self.root = root
		self.schema = schema

	def build(self, action: str) -> None:
		plan = self.schema.plan(action)
		try:
			self._check_plan(plan)
			plan.output.mkdir(parents=True, exist_ok=True)
			artifacts: list[Artifact] = []
			for target in plan.targets:
				artifacts.append(self._build_target(plan, target))
			self._print_artifacts(artifacts)
		except ConfigError as exc:
			raise BuildError(f"action {action}: {exc}") from exc

	def _check_plan(self, plan: BuildPlan) -> None:
		for target in plan.targets:
			if target.use_common:
				self._check_entries(plan.source, plan.output, target, "common", plan.common)
			self._check_entries(plan.source, plan.output, target, "files", target.files)
			self._resolve_source_path(plan.source, target.manifest, f"target {target.name}: manifest {target.manifest}")
			if target.bundle is not None:
				self._resolve_output_path(plan.output, target.bundle, f"target {target.name}: bundle {target.bundle}")

	def _check_entries(self, source_root: Path, output_root: Path, target: Target, group: str, entries: tuple[FileEntry, ...]) -> None:
		target_root = self._resolve_output_path(output_root, target.output, f"target {target.name}: output {target.output}")
		for entry in entries:
			label = f"target {target.name}: {group} {entry.label}: {entry.source} -> {entry.target}"
			self._resolve_source_path(source_root, entry.source, label)
			self._resolve_output_path(target_root, entry.target, label)

	def _build_target(self, plan: BuildPlan, target: Target) -> Artifact:
		target_dir = self._resolve_output_path(plan.output, target.output, f"target {target.name}: output {target.output}")
		bundle_path = None
		if target_dir.exists():
			shutil.rmtree(target_dir)
		target_dir.mkdir(parents=True)
		if target.use_common:
			self._copy_entries(plan.source, target_dir, target, "common", plan.common)
		self._copy_entries(plan.source, target_dir, target, "files", target.files)
		self._copy_manifest(plan.source, target_dir, target)
		if target.bundle is not None:
			bundle_path = self._resolve_output_path(plan.output, target.bundle, f"target {target.name}: bundle {target.bundle}")
			self._write_bundle(target_dir, bundle_path)
		print(f"built {target.name}: {target_dir}")
		return Artifact(target=target.name, output=target_dir, bundle=bundle_path)

	def _print_artifacts(self, artifacts: list[Artifact]) -> None:
		if not artifacts:
			return
		print()
		print("Artifacts:")
		for artifact in artifacts:
			print(f"  {artifact.target}:")
			print(f"    output: {artifact.output}")
			if artifact.bundle is not None:
				print(f"    bundle: {artifact.bundle}")

	def _copy_entries(self, source_root: Path, target_root: Path, target: Target, group: str, entries: tuple[FileEntry, ...]) -> None:
		for entry in entries:
			label = f"target {target.name}: {group} {entry.label}: {entry.source} -> {entry.target}"
			source = self._resolve_source_path(source_root, entry.source, label)
			destination = self._resolve_output_path(target_root, entry.target, label)
			self._copy_path(source, destination)

	def _copy_manifest(self, source_root: Path, target_root: Path, target: Target) -> None:
		label = f"target {target.name}: manifest {target.manifest}"
		source = self._resolve_source_path(source_root, target.manifest, label)
		destination = self._resolve_output_path(target_root, Path("manifest.json"), label)
		self._copy_path(source, destination)

	def _copy_path(self, source: Path, target: Path) -> None:
		if not source.exists():
			raise ConfigError(f"Missing source path: {source}")
		if source.is_dir():
			if target.exists():
				shutil.rmtree(target)
			shutil.copytree(source, target)
			return
		target.parent.mkdir(parents=True, exist_ok=True)
		shutil.copy2(source, target)

	def _write_bundle(self, source_dir: Path, bundle_path: Path) -> None:
		bundle_path.parent.mkdir(parents=True, exist_ok=True)
		if bundle_path.exists():
			bundle_path.unlink()
		with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as archive:
			for file in source_dir.rglob("*"):
				if file.is_file():
					archive.write(file, file.relative_to(source_dir))

	def _resolve_source_path(self, root: Path, rel: Path, label: str) -> Path:
		path = self._resolve_under(root, rel, label)
		if not path.exists():
			raise ConfigError(f"{label}: missing source path: {path}")
		return path

	def _resolve_output_path(self, root: Path, rel: Path, label: str) -> Path:
		return self._resolve_under(root, rel, label)

	@staticmethod
	def _resolve_under(root: Path, rel: Path, label: str) -> Path:
		resolved = (root / rel).resolve()
		root_resolved = root.resolve()
		try:
			resolved.relative_to(root_resolved)
		except ValueError as exc:
			raise ConfigError(f"{label} escapes its root: {rel}") from exc
		return resolved

def load_schema(root: Path, config_path: Path) -> PackageSchema:
	try:
		with config_path.open("r", encoding="utf-8") as file:
			config = json.load(file)
	except FileNotFoundError as exc:
		raise ConfigError(f"Config file not found: {config_path}") from exc
	except json.JSONDecodeError as exc:
		raise ConfigError(f"Invalid JSON in {config_path}: {exc}") from exc
	schema_version = config.get("schema") if isinstance(config, dict) else None
	schema_class = SCHEMAS.get(schema_version)
	if schema_class is None:
		raise ConfigError(f"Unsupported schema: {schema_version}")
	return schema_class(root, config)

def print_usage(schema: PackageSchema) -> None:
	print("Usage: py build.py <action>")
	print()
	print("Available actions:")
	for name, targets in schema.describe_actions():
		print(f"  {name} -> {', '.join(targets)}")

def main(argv: list[str]) -> int:
	root = Path(__file__).resolve().parent
	try:
		schema = load_schema(root, root / CONFIG_FILE)
		if len(argv) == 1:
			print_usage(schema)
			return 0
		if len(argv) != 2:
			print_usage(schema)
			return 2
		action = argv[1]
		if action not in schema.list_actions():
			print_usage(schema)
			return 2
		PackageBuilder(root, schema).build(action)
		return 0
	except ConfigError as exc:
		print(f"error: {exc}", file=sys.stderr)
		return 1
	except BuildError as exc:
		print(f"error: {exc}", file=sys.stderr)
		return 1

if __name__ == "__main__":
	raise SystemExit(main(sys.argv))
