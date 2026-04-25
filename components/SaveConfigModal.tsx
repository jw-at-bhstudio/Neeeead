import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';

interface SaveConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (name: string, soundMimic: string, creatorName?: string) => Promise<void>;
    requireCreatorName?: boolean;
    defaultCreatorName?: string;
}

type Segment = 1 | 2 | 3;
type RhythmOption = {
    id: string;
    groups: Segment[][];
};

const NAME_LIMIT = 20;
const NAME_TOO_LONG_HINTS = [
    "这名字太难记了",
    "太长了写不下",
    "你起的名字自己记得住吗",
    "短一点，求你了",
    "是人吗叫这个名字",
];

const SOUND_CHAR_OPTIONS = [
    "啊", "嗷", "啵", "哒", "叮", "咚", "嘟", "嗯", "嘎", "咯",
    "咕", "呱", "咣", "哈", "嗨", "哼", "嘿", "呼", "叽", "桀",
    "啾", "咔", "咳", "哭", "啷", "啦", "哩", "隆", "噜", "咩",
    "咪", "喵", "喃", "喏", "啪", "啪", "嘭", "噗", "嘶", "哇",
    "汪", "喔", "呜", "唔", "嘻", "咻", "咿", "呀", "哟", "吱",
];

const X_PATTERNS: Segment[][] = [
    [1],    // A
    [2],    // AA
    [1, 2], // A-AA
    [2, 1], // AA-A
    [3],    // AAA
];

function shuffleArray<T>(arr: T[]): T[] {
    const next = [...arr];
    for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
}

function patternToText(segments: Segment[]) {
    return segments.map((size) => "A".repeat(size)).join("-");
}

function rhythmToTemplate(option: RhythmOption) {
    return `[${option.groups.map((g) => patternToText(g)).join("~")}]`;
}

function flattenSlotCount(option: RhythmOption | null) {
    if (!option) return 0;
    return option.groups.flat().reduce((sum, n) => sum + n, 0);
}

function buildSoundFromSlots(option: RhythmOption, slots: string[]) {
    let cursor = 0;
    const groupStrings = option.groups.map((segments) => {
        const segmentStrings = segments.map((segmentLength) => {
            const chars = slots.slice(cursor, cursor + segmentLength);
            cursor += segmentLength;
            return chars.join("");
        });
        return segmentStrings.join("-");
    });
    return groupStrings.join("~");
}

function pickRandomChar(pool: string[]) {
    return pool[Math.floor(Math.random() * pool.length)];
}

function getGroupRanges(option: RhythmOption): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const group of option.groups) {
        const size = group.reduce((sum, n) => sum + n, 0);
        ranges.push({ start: cursor, end: cursor + size });
        cursor += size;
    }
    return ranges;
}

function createRandomRhythmOptions(): RhythmOption[] {
    const all: RhythmOption[] = [];
    let idx = 0;

    // 一组：[X]
    for (const p of X_PATTERNS) {
        all.push({ id: `r-${idx++}`, groups: [p] });
    }

    // 两组：[X~X]
    for (const p1 of X_PATTERNS) {
        for (const p2 of X_PATTERNS) {
            all.push({ id: `r-${idx++}`, groups: [p1, p2] });
        }
    }

    return shuffleArray(all).slice(0, 5);
}

export const SaveConfigModal: React.FC<SaveConfigModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    requireCreatorName = false,
    defaultCreatorName = "匿名创作者",
}) => {
    const [name, setName] = useState('');
    const [creatorName, setCreatorName] = useState(defaultCreatorName);
    const [nameHint, setNameHint] = useState<string | null>(null);
    const [rhythmOptions, setRhythmOptions] = useState<RhythmOption[]>([]);
    const [selectedRhythmId, setSelectedRhythmId] = useState<string | null>(null);
    const [slotChars, setSlotChars] = useState<string[]>([]);
    const [slotSources, setSlotSources] = useState<Array<'empty' | 'manual' | 'auto'>>([]);
    const [activeSlotIndex, setActiveSlotIndex] = useState(0);
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const options = createRandomRhythmOptions();
        setRhythmOptions(options);
        setSelectedRhythmId(options[0]?.id ?? null);
        setName('');
        setNameHint(null);
        setCurrentStep(1);
        setSlotChars([]);
        setSlotSources([]);
        setActiveSlotIndex(0);
        setErrorMsg(null);
        setCreatorName(defaultCreatorName || "匿名创作者");
    }, [isOpen, defaultCreatorName]);

    const selectedRhythm = useMemo(
        () => rhythmOptions.find((item) => item.id === selectedRhythmId) ?? null,
        [rhythmOptions, selectedRhythmId]
    );
    const displayName = name.trim() || "你的捏物";

    useEffect(() => {
        const needed = flattenSlotCount(selectedRhythm);
        if (needed <= 0) {
            setSlotChars([]);
            setSlotSources([]);
            setActiveSlotIndex(0);
            return;
        }

        setSlotChars((prev) => {
            const next = Array.from({ length: needed }, (_, i) => prev[i] ?? '');
            return next;
        });
        setSlotSources((prev) => {
            const next = Array.from(
                { length: needed },
                (_, i) => prev[i] ?? 'empty'
            ) as Array<'empty' | 'manual' | 'auto'>;
            return next;
        });
        setActiveSlotIndex((prev) => Math.min(prev, needed - 1));
    }, [selectedRhythm]);

    if (!isOpen) return null;

    const handleNameChange = (nextValue: string) => {
        if (nextValue.length <= NAME_LIMIT) {
            setName(nextValue);
            setNameHint(null);
            return;
        }

        const randomHint = NAME_TOO_LONG_HINTS[Math.floor(Math.random() * NAME_TOO_LONG_HINTS.length)];
        setNameHint(randomHint);
    };

    const handleChooseCharForActiveSlot = (value: string) => {
        setSlotChars((prev) => prev.map((char, idx) => (idx === activeSlotIndex ? value : char)));
        setSlotSources((prev) =>
            prev.map((source, idx) => (idx === activeSlotIndex ? 'manual' : source))
        );
        setErrorMsg(null);

        setActiveSlotIndex((prev) => {
            for (let i = prev + 1; i < slotChars.length; i += 1) {
                if (!slotChars[i]) return i;
            }
            return prev;
        });
    };

    const handleShuffleWeird = () => {
        setSlotChars((prevChars) => {
            const next = [...prevChars];
            const used = new Set<string>();

            for (let i = 0; i < next.length; i += 1) {
                const source = slotSources[i] ?? 'empty';
                const current = next[i];
                if (source === 'manual') {
                    if (current) used.add(current);
                    continue;
                }

                const prev = i > 0 ? next[i - 1] : '';
                if (prev && Math.random() < 0.05) {
                    next[i] = prev;
                    used.add(prev);
                    continue;
                }

                const uniquePool = SOUND_CHAR_OPTIONS.filter((char) => !used.has(char));
                if (uniquePool.length > 0) {
                    const picked = pickRandomChar(uniquePool);
                    next[i] = picked;
                    used.add(picked);
                    continue;
                }

                const nonPrevPool = prev
                    ? SOUND_CHAR_OPTIONS.filter((char) => char !== prev)
                    : SOUND_CHAR_OPTIONS;
                const fallback = pickRandomChar(nonPrevPool.length > 0 ? nonPrevPool : SOUND_CHAR_OPTIONS);
                next[i] = fallback;
                used.add(fallback);
            }

            return next;
        });
        setSlotSources((prevSources) =>
            prevSources.map((source) => (source === 'manual' ? 'manual' : 'auto'))
        );
    };

    const handleShuffleNormal = () => {
        if (!selectedRhythm) return;
        const ranges = getGroupRanges(selectedRhythm);

        setSlotChars((prevChars) => {
            const next = [...prevChars];

            for (const range of ranges) {
                const groupStart = range.start;
                const groupEnd = range.end;
                const firstSource = slotSources[groupStart] ?? 'empty';
                const groupAnchor =
                    firstSource === 'manual' && next[groupStart]
                        ? next[groupStart]
                        : pickRandomChar(SOUND_CHAR_OPTIONS);

                for (let i = groupStart; i < groupEnd; i += 1) {
                    const source = slotSources[i] ?? 'empty';
                    if (source === 'manual') continue;

                    if (i === groupStart) {
                        next[i] = groupAnchor;
                        continue;
                    }

                    const prev = next[i - 1];
                    if (prev && Math.random() < 0.5) {
                        next[i] = prev;
                        continue;
                    }

                    const nonPrevPool = SOUND_CHAR_OPTIONS.filter((char) => char !== prev);
                    if (groupAnchor !== prev && Math.random() < 0.7) {
                        next[i] = groupAnchor;
                    } else {
                        next[i] = pickRandomChar(nonPrevPool.length > 0 ? nonPrevPool : SOUND_CHAR_OPTIONS);
                    }
                }
            }

            return next;
        });
        setSlotSources((prevSources) =>
            prevSources.map((source) => (source === 'manual' ? 'manual' : 'auto'))
        );
    };

    const handleResetSlots = () => {
        setSlotChars((prev) => prev.map(() => ''));
        setSlotSources((prev) => prev.map(() => 'empty'));
        setActiveSlotIndex(0);
    };

    const handleSubmit = async () => {
        const trimmedName = name.trim();
        const trimmedCreator = creatorName.trim();
        const hasUnfilledSlot = slotChars.some((char) => !char);
        const builtSound = selectedRhythm ? buildSoundFromSlots(selectedRhythm, slotChars) : '';

        if (!trimmedName) {
            setErrorMsg('给你的捏物起个名字吧');
            return;
        }
        if (requireCreatorName && !trimmedCreator) {
            setErrorMsg('给创作者留个名字吧');
            return;
        }
        if (trimmedName.length > NAME_LIMIT) {
            setErrorMsg(`名字最多 ${NAME_LIMIT} 个字`);
            return;
        }
        if (!selectedRhythm) {
            setErrorMsg('先选一个叫声节奏吧');
            return;
        }
        if (hasUnfilledSlot) {
            setErrorMsg('还有字位没选完，先补齐叫声');
            return;
        }

        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            await onConfirm(trimmedName, builtSound, trimmedCreator || "匿名创作者");
        } catch (error) {
            setErrorMsg(error instanceof Error ? error.message : '操作失败，请重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    const goNextStep = () => {
        if (currentStep === 1) {
            const trimmedName = name.trim();
            if (!trimmedName) {
                setErrorMsg('先给捏物起个名字');
                return;
            }
            if (trimmedName.length > NAME_LIMIT) {
                setErrorMsg(`名字最多 ${NAME_LIMIT} 个字`);
                return;
            }
            setErrorMsg(null);
            setCurrentStep(2);
            return;
        }

        if (currentStep === 2) {
            if (!selectedRhythm) {
                setErrorMsg('先选一个叫声节奏吧');
                return;
            }
            setErrorMsg(null);
            setCurrentStep(3);
        }
    };

    const goPrevStep = () => {
        setErrorMsg(null);
        setCurrentStep((prev) => (prev === 1 ? 1 : ((prev - 1) as 1 | 2 | 3)));
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-bg border border-surface p-5 sm:p-8 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5 relative">
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-2xl text-text-muted hover:text-text leading-none"
                    disabled={isSubmitting}
                >
                    &times;
                </button>
                
                <div className="text-center space-y-2">
                    <h2 className="text-lg text-text">
                        配置你的卡片
                    </h2>
                    <p className="text-lg text-text-muted">
                        第 {currentStep} / 3 步
                    </p>
                </div>
                <div className="flex gap-2">
                    {[1, 2, 3].map((step) => (
                        <div
                            key={step}
                            className={`h-1.5 flex-1 rounded ${
                                currentStep >= step ? "bg-primary" : "bg-surface"
                            }`}
                        />
                    ))}
                </div>

                {currentStep === 1 && (
                    <div className="space-y-2">
                        <label className="text-lg text-text">你的捏物叫什么？</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="给你的捏物一个独一无二的名字吧"
                            className="w-full text-text bg-surface px-3 py-2 rounded border border-border focus:ring-1 focus:ring-primary focus:border-primary"
                        />
                        <p className="text-lg text-text-muted">{name.length}/{NAME_LIMIT}</p>
                        {nameHint && <p className="text-lg text-alert">{nameHint}</p>}
                        {requireCreatorName && (
                            <div className="pt-2 space-y-1">
                                <label className="text-lg text-text">创作者名字（未登录时显示）</label>
                                <input
                                    type="text"
                                    value={creatorName}
                                    onChange={(e) => setCreatorName(e.target.value)}
                                    maxLength={20}
                                    placeholder="给创作者留个名字"
                                    className="w-full text-text bg-surface px-3 py-2 rounded border border-border focus:ring-1 focus:ring-primary focus:border-primary"
                                />
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-2">
                        <label className="text-lg text-text">{displayName} 唱歌的节奏会是？</label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {rhythmOptions.map((option) => {
                                const isActive = selectedRhythmId === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setSelectedRhythmId(option.id)}
                                        className={`rounded border px-3 py-2 text-left text-lg transition-colors ${
                                            isActive
                                                ? "border-primary text-text bg-surface"
                                                : "border-border text-text-muted hover:text-text hover:border-primary"
                                        }`}
                                    >
                                        {rhythmToTemplate(option)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-3">
                        <label className="text-lg text-text">{displayName} 唱歌的声音会像是？</label>
                        {selectedRhythm && (
                            <p className="text-lg text-text-muted">当前节奏：{rhythmToTemplate(selectedRhythm)}</p>
                        )}

                        <div className="rounded border border-border p-2">
                            <div className="grid grid-cols-5 sm:grid-cols-8 gap-1">
                                {slotChars.map((char, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setActiveSlotIndex(idx)}
                                        className={`rounded border px-2 py-1 text-lg ${
                                            activeSlotIndex === idx
                                                ? "border-primary text-text bg-surface"
                                                : "border-border text-text-muted"
                                        }`}
                                    >
                                        {char || "·"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                className="text-lg px-3 py-1.5 h-auto"
                                onClick={handleShuffleWeird}
                            >
                                来个奇怪的
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="text-lg px-3 py-1.5 h-auto"
                                onClick={handleShuffleNormal}
                            >
                                正常一点
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="text-lg px-3 py-1.5 h-auto"
                                onClick={handleResetSlots}
                            >
                                清空
                            </Button>
                        </div>

                        <div className="rounded border border-border/50 p-2">
                            <p className="text-lg text-text-muted mb-2">点下面任意字，填到当前选中字位</p>
                            <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
                                {SOUND_CHAR_OPTIONS.map((opt, idx) => (
                                    <button
                                        key={`${opt}-${idx}`}
                                        type="button"
                                        onClick={() => handleChooseCharForActiveSlot(opt)}
                                        className="rounded border border-border px-2 py-1 text-lg text-text-muted hover:text-text hover:border-primary"
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <p className="text-lg text-text">
                            预览：{selectedRhythm ? buildSoundFromSlots(selectedRhythm, slotChars.map((c) => c || "·")) : "-"}
                        </p>
                    </div>
                )}

                {errorMsg && (
                    <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-200 text-lg">
                        {errorMsg}
                    </div>
                )}

                <div className="flex gap-2 pt-1">
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={currentStep === 1 ? onClose : goPrevStep}
                        disabled={isSubmitting}
                    >
                        {currentStep === 1 ? "取消" : "上一步"}
                    </Button>
                    {currentStep < 3 ? (
                        <Button type="button" className="w-full" onClick={goNextStep} disabled={isSubmitting}>
                            下一步
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? '处理中...' : '生成预览'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
