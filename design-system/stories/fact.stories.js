export default { title: "Components/Fact" };

export const ThreeFacts = {
  render: () => `
    <div class="facts">
      <div class="fact">
        <span class="fact__num">42<small>km</small></span>
        <span class="fact__title">Endurance</span>
        <span class="fact__label">Marathon finisher. Multi-year engagements don't wear me down.</span>
      </div>
      <div class="fact">
        <span class="fact__num">250<small>kg</small></span>
        <span class="fact__title">Power</span>
        <span class="fact__label">Heaviest lift. I ship heavy things — whole systems, not single screens.</span>
      </div>
      <div class="fact">
        <span class="fact__num">2<small>m up</small></span>
        <span class="fact__title">Balance</span>
        <span class="fact__label">Walks on stilts. Design craft on one side, production code on the other.</span>
      </div>
    </div>`,
};
