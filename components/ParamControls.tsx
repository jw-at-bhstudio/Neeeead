
import React, { useState, useEffect } from 'react';
import { Slider } from './Slider';
import { Button } from './Button';
import { Range, PresetParams, AppMode, QuizAnswerValues, FitMode } from '../utils/types';
import { ToggleSwitch } from './ToggleSwitch';
import { PresetRangeControl } from './PresetRangeControl';
import { CopyIcon } from './icons';
import { Point } from '../utils/geometry';
import { AuthModal } from './AuthModal';
import { getCurrentUser, saveMyCreatureDraft } from '../lib/supabase/creatures';
import type { Json } from '../lib/supabase/database.types';

interface ParamControlsProps {
    mode: AppMode;
    setMode: (mode: AppMode) => void;
    fitMode: FitMode;
    setFitMode: (mode: FitMode) => void;
    // Normalized 0-1 values for viewer mode
    quizAnswers: QuizAnswerValues;
    setQuizAnswers: (value: any) => void;
    // Direct values for dev mode
    numPoints: number;
    setNumPoints: (value: number) => void;
    irregularity: number;
    setIrregularity: (value: number) => void;
    complexity: number;
    setComplexity: (value: number) => void;
    roundness: number;
    setRoundness: (value: number) => void;
    strokeOffset: number;
    setStrokeOffset: (value: number) => void;
    // Action props
    onRegenerate: () => void;
    onRandomize: () => void;
    onRetakeQuiz: () => void;
    onGenerateCard: () => void;
    isGeneratingCard: boolean;
    onStartOver: () => void;
    // Dev mode specific props
    showHandles: boolean;
    setShowHandles: (value: boolean) => void;
    onExpand: () => void;
    onCopySVG: () => void;
    copyButtonText: string;
    // Eyes
    eyes: Point[];
    onRemoveEyes: () => void;
    isValidShape: boolean;
    validationMessage: string;
    onAutoFix: () => void;
    isAutoFixing: boolean;
    // Mobile rendering trick
    canvasSlot?: React.ReactNode;
    // Save draft payload source
    seed: number;
    pathData: string;
}

const viewerModeSliders = [
    { id: 'numPoints', label: '知己多少', minLabel: '少而精', maxLabel: '广而多' },
    { id: 'irregularity', label: '行事风格', minLabel: '计划派', maxLabel: '随性派' },
    { id: 'complexity', label: '内心世界', minLabel: '简单纯粹', maxLabel: '丰富纠结' },
    { id: 'strokeOffset', label: '处世态度', minLabel: '坦率直接', maxLabel: '圆融周到' },
];

const developerModeLabels = {
    numPoints: "金 (3~400)",
    irregularity: "火 (0~1)",
    complexity: "木 (0~1)",
    roundness: "水 (0~1)",
    strokeOffset: "土 (50~1000)"
};

export const ParamControls: React.FC<ParamControlsProps> = (props) => {
    const {
        mode, setMode, quizAnswers, setQuizAnswers,
        onRegenerate, onRandomize,
        showHandles, setShowHandles, onRetakeQuiz, onGenerateCard, isGeneratingCard, onStartOver,
        onExpand, onCopySVG, copyButtonText, eyes, onRemoveEyes,
        isValidShape, validationMessage, onAutoFix, isAutoFixing,
        canvasSlot, seed, pathData
    } = props;

    const isViewer = mode === 'viewer';
    
    // Auth and Save state
    const [user, setUser] = useState<any>(null);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        getCurrentUser().then(setUser).catch(console.error);
    }, []);

    const handleSave = async () => {
        if (!user) {
            setIsAuthModalOpen(true);
            return;
        }

        setIsSaving(true);
        try {
            await saveMyCreatureDraft({
                seed: seed || 0,
                params: {
                    numPoints: props.numPoints,
                    irregularity: props.irregularity,
                    complexity: props.complexity,
                    roundness: props.roundness,
                    strokeOffset: props.strokeOffset
                },
                shape: { pathData },
                eyes: eyes.map((eye) => ({ x: eye.x, y: eye.y })) as unknown as Json
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to save draft:", error);
            alert("保存失败，请稍后重试");
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <aside className="w-full lg:w-96 bg-bg p-[6px] lg:p-0 flex flex-col gap-6 lg:h-full lg:overflow-hidden overflow-y-auto">
            <div className="flex-shrink-0 flex justify-between items-center">
                <div className="flex flex-col">
                    <h1 className="text-[18pt] text-text leading-tight">{isViewer ? "顺手捏" : "大师捏"}</h1>
                    <p className="text-xs text-text-muted mt-1">
                        {isViewer ? "普通人，捏只普通的物" : "捏的不好，就是你的问题了"}
                    </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                    {user ? (
                        <span className="text-primary truncate max-w-[80px]" title={user.email}>{user.email?.split('@')[0]}</span>
                    ) : (
                        <button onClick={() => setIsAuthModalOpen(true)} className="text-text-muted hover:text-text transition-colors">登录/注册</button>
                    )}
                    <div className="flex items-center gap-2">
                        <label htmlFor="mode-toggle" className={`cursor-pointer transition-colors ${!isViewer ? 'text-primary' : 'text-text-muted hover:text-text'}`}>
                            天工捏物
                        </label>
                        <ToggleSwitch
                            id="mode-toggle"
                            label=""
                            checked={!isViewer}
                            onChange={e => setMode(e.target.checked ? 'developer' : 'viewer')}
                        />
                    </div>
                </div>
            </div>

            {/* In mobile layout, we want to inject the canvas here. */}
            <div className="lg:hidden flex-shrink-0 w-full relative bg-black/20 rounded-[6px] overflow-hidden">
                {canvasSlot}
            </div>
            
            {isViewer && (
                 <div className="flex-shrink-0 hidden lg:block">
                 </div>
            )}

            <div className="flex-none lg:flex-1 min-h-0 lg:overflow-y-auto p-[6px] space-y-6 border border-surface rounded-[6px] custom-scrollbar">
                
                {isViewer ? (
                    <div className="space-y-4">
                        {viewerModeSliders.map(slider => (
                            <Slider 
                                key={slider.id}
                                label={slider.label}
                                min={0}
                                max={1}
                                step={0.01}
                                value={quizAnswers[slider.id]}
                                onChange={e => setQuizAnswers((prev: any) => ({ ...prev, [slider.id]: Number(e.target.value) }))}
                                minLabel={slider.minLabel}
                                maxLabel={slider.maxLabel}
                                hideInput
                            />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            <Slider label={developerModeLabels.numPoints} min={3} max={400} value={props.numPoints} onChange={e => props.setNumPoints(Number(e.target.value))} />
                            <Slider label={developerModeLabels.irregularity} min={0} max={1} step={0.01} value={props.irregularity} onChange={e => props.setIrregularity(Number(e.target.value))} />
                            <Slider label={developerModeLabels.complexity} min={0} max={1} step={0.01} value={props.complexity} onChange={e => props.setComplexity(Number(e.target.value))} />
                            <Slider label={developerModeLabels.roundness} min={0} max={1} step={0.01} value={props.roundness} onChange={e => props.setRoundness(Number(e.target.value))} />
                            <Slider label={developerModeLabels.strokeOffset} min={50} max={1000} value={props.strokeOffset} onChange={e => props.setStrokeOffset(Number(e.target.value))} />
                        </div>
                        <div className="border-t border-border pt-6 flex items-center justify-between">
                            <span className="text-sm text-text">内视</span>
                            <ToggleSwitch id="show-handles-toggle" label="" checked={showHandles} onChange={(e) => setShowHandles(e.target.checked)} />
                        </div>
                    </>
                )}
            </div>

            <div className="flex-shrink-0 space-y-3">
                <div className="flex gap-3">
                    <Button onClick={onRegenerate} variant="secondary" className="w-full">
                        {isViewer ? "再蠕动一下" : "回炉重造下"}
                    </Button>
                    <Button onClick={onRandomize} variant="secondary" className="w-full">
                        {isViewer ? "算了，瞎捏一只" : "算了，听天由命"}
                    </Button>
                </div>
                
                <div className="space-y-3">
                    {!isValidShape && (
                        <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-[4px] text-red-200 text-sm flex flex-col gap-2">
                            <p>{validationMessage}</p>
                            <Button onClick={onAutoFix} disabled={isAutoFixing} variant="secondary" className="w-full text-xs py-1.5 h-auto">
                                {isAutoFixing ? '修复中...' : '帮我修复'}
                            </Button>
                        </div>
                    )}
                    <Button 
                        onClick={handleSave} 
                        variant="secondary"
                        className="w-full" 
                        disabled={isSaving || !isValidShape || eyes.length === 0 || eyes.length > 3}
                    >
                        {isSaving ? '保存中...' : saveSuccess ? '已保存！' : '保存我的捏物'}
                    </Button>
                    <Button 
                        onClick={onGenerateCard} 
                        className="w-full" 
                        disabled={isGeneratingCard || !isValidShape || eyes.length === 0 || eyes.length > 3}
                    >
                        {isGeneratingCard ? '生成中...' : '生成我的捏物卡片'}
                    </Button>
                    <Button onClick={onExpand} className="hidden lg:block w-full" variant="secondary">
                        导出矢量图形
                    </Button>
                </div>
            </div>
             <footer className="flex-shrink-0 text-center text-xs text-surface space-y-1 mt-2">
                <p>© 2025 四百盒子社区</p>
                <p>设计 嘉文@不含观点°</p>
            </footer>
            
            <AuthModal 
                isOpen={isAuthModalOpen} 
                onClose={() => setIsAuthModalOpen(false)} 
                onSuccess={() => getCurrentUser().then(setUser)}
            />
        </aside>
    );
};
