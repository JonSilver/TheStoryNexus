import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuideProvider, mdxComponents } from "../components/mdx";
import AdvancedGuide from "../content/advanced.mdx";
import BasicsGuide from "../content/basics.mdx";
import BibleGuide from "../content/bible.mdx";
import WritingWithAiGuide from "../content/writing-with-ai.mdx";

const SECTIONS = [
    { value: "basics", label: "Getting Started", Content: BasicsGuide },
    { value: "writing-with-ai", label: "Writing with AI", Content: WritingWithAiGuide },
    { value: "bible", label: "Story Bible", Content: BibleGuide },
    { value: "advanced", label: "Advanced", Content: AdvancedGuide }
] as const;

export default function GuidePage() {
    const [activeTab, setActiveTab] = useState<string>(SECTIONS[0].value);

    return (
        <div className="container mx-auto max-w-5xl px-4 py-4 sm:py-8">
            <Card>
                <CardHeader>
                    <CardTitle>Welcome to The Story Nexus</CardTitle>
                    <CardDescription>
                        Writing in front, machinery behind — how to get the most out of it
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid grid-cols-2 sm:grid-cols-4 mb-8 h-auto">
                            {SECTIONS.map(({ value, label }) => (
                                <TabsTrigger key={value} value={value}>
                                    {label}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {SECTIONS.map(({ value, Content }) => (
                            <TabsContent key={value} value={value} className="space-y-4">
                                <GuideProvider>
                                    <Content components={mdxComponents} />
                                </GuideProvider>
                            </TabsContent>
                        ))}
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
