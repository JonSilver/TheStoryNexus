import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface SliderConfig {
    min: number;
    max: number;
    step: number;
    decimals?: number;
    defaultEnabled?: number;
}

interface SliderWithInputProps {
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    config: SliderConfig;
    disableable?: boolean;
}

const formatValue = (value: number, decimals: number | undefined, disabled: boolean): string => {
    if (disabled) return "Disabled";
    return decimals !== undefined ? value.toFixed(decimals) : value.toString();
};

const parseValue = (input: string, isFloat: boolean): number =>
    isFloat ? parseFloat(input) : parseInt(input, 10);

export const SliderWithInput = ({ id, label, value, onChange, config, disableable = false }: SliderWithInputProps) => {
    const { min, max, step, decimals, defaultEnabled } = config;
    const isDisabled = disableable && value === 0;
    const isFloat = step < 1;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value === "") return;
        const parsed = parseValue(e.target.value, isFloat);
        if (!Number.isNaN(parsed) && parsed >= min && parsed <= max) onChange(parsed);
    };

    const handleToggle = () => {
        onChange(isDisabled ? (defaultEnabled ?? 1) : 0);
    };

    return (
        <div className="flex items-center gap-4">
            <Label htmlFor={id} className="w-28">
                {label}
            </Label>
            <div className="flex-1 flex items-center gap-2">
                <Slider
                    id={id}
                    value={[value]}
                    onValueChange={v => onChange(v[0])}
                    min={min}
                    max={max}
                    step={step}
                    className="flex-1"
                    disabled={isDisabled}
                />
                <Input
                    type="text"
                    value={formatValue(value, decimals, isDisabled)}
                    onChange={handleInputChange}
                    className="w-20 text-center"
                />
                {disableable && (
                    <Button
                        type="button"
                        variant={isDisabled ? "default" : "outline"}
                        onClick={handleToggle}
                        className="whitespace-nowrap"
                    >
                        {isDisabled ? "Enable" : "Disable"}
                    </Button>
                )}
            </div>
        </div>
    );
};
