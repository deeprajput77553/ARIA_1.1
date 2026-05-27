import { MessageSquare, Database, GitBranch, Cpu, Eye, Send, Workflow } from 'lucide-react';

function PipelineVisualizer({ pipelineState }) {
    if (!pipelineState) return null;

    const stages = [
        { id: 'input', title: '1. Input', icon: <MessageSquare size={18} /> },
        { id: 'context', title: '2. Context', icon: <Database size={18} /> },
        { id: 'router', title: '3. Router', icon: <GitBranch size={18} /> },
        { id: 'exec', title: '4. Execution', icon: <Cpu size={18} /> },
        { id: 'reflect', title: '5. Reflection', icon: <Eye size={18} /> },
        { id: 'output', title: '6. Output', icon: <Send size={18} /> }
    ];

    return (
        <div className="pipeline-container">
            <h3 className="pipeline-section-title">
                <Workflow size={16} /> Current Pipeline Run
            </h3>
            <div className="pipeline-flow">
                {stages.map(stage => {
                    const data = pipelineState[stage.id] || { status: '', detail: '-', badge: '-' };
                    return (
                        <div key={stage.id} className={`pipeline-stage-card ${data.status}`} id={`stage-${stage.id}`}>
                            <div className="stage-card-header">
                                <span className="stage-card-title-text">
                                    {stage.icon} {stage.title}
                                </span>
                                <span className={`stage-card-badge ${data.status}`}>
                                    {data.badge || 'IDLE'}
                                </span>
                            </div>
                            <div className="stage-card-detail" title={data.detail}>
                                {data.detail || '-'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default PipelineVisualizer;
