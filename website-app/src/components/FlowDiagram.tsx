import type { LucideIcon } from "lucide-react";
import { ArrowRight, ArrowDown } from "lucide-react";

export type FlowNode = {
  icon: LucideIcon;
  title: string;
  caption: string;
};

export function FlowDiagram({ nodes }: { nodes: FlowNode[] }) {
  return (
    <div className="my-6 font-['Inter',system-ui,sans-serif]">
      <div className="rounded-[6px] border border-[#eaeaea] bg-[#fafafa] p-4 sm:p-5 overflow-x-auto">
        <div className="flex items-stretch gap-0 min-w-[560px] sm:min-w-0">
          {nodes.map((node, i) => {
            const Icon = node.icon;
            return (
              <div key={node.title} className="flex items-center flex-1">
                <div className="flex flex-col items-center text-center gap-1.5 w-[100px] shrink-0">
                  <div className="w-9 h-9 rounded-full bg-white border border-[#ddd] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#111]" />
                  </div>
                  <div className="text-[11.5px] font-medium text-[#111] leading-tight">
                    {node.title}
                  </div>
                  <div className="text-[10px] font-mono text-[#999] leading-tight">
                    {node.caption}
                  </div>
                </div>
                {i < nodes.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-[#ccc] shrink-0 mx-1 sm:mx-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#999] sm:hidden">
        <ArrowDown className="w-3 h-3" />
        <span>Scroll to see the full pipeline</span>
      </div>
    </div>
  );
}
