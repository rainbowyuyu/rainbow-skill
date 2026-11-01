"""Original 3b1b-inspired mathematical scenes, ported to Manim Community.

Engine tested: Manim Community 0.19.1 (Cairo), Python 3.10.11.
This is not 3b1b's ManimGL source and does not reproduce his video assets.
All geometry/readouts derive from the same mathematical parameters.
"""
from manim import *
import numpy as np

BG = "#0B1423"
INK = "#F0F4FA"
MUTED = "#A5B4CB"
GRID = "#263A54"
CYAN = "#62D6F6"
ROSE = "#FF7CA8"
GOLD = "#FFCB78"
MINT = "#7DE5BC"
FONT = "Microsoft YaHei"


def label(text, size=24, color=INK):
    return Text(text, font=FONT, font_size=size, color=color)


class StudyScene(Scene):
    def header(self, index, title, subtitle):
        self.camera.background_color = BG
        overline = label(f"MANIM STUDY  /  {index}", 15, CYAN).to_edge(UP, buff=0.32).to_edge(LEFT, buff=0.55)
        heading = label(title, 32).next_to(overline, DOWN, aligned_edge=LEFT, buff=0.13)
        hint = label(subtitle, 19, MUTED).next_to(heading, DOWN, aligned_edge=LEFT, buff=0.13)
        rule = Line(LEFT * 6.55, RIGHT * 6.55, stroke_color=GRID, stroke_width=1).move_to(UP * 2.45)
        self.add(overline, heading, hint, rule)

    def footer(self, text):
        return label(text, 21, MUTED).move_to(DOWN * 3.46)


class FormulaSemanticTransform(StudyScene):
    """Distributivity: one factor has two destinations, so explicitly copy it."""
    def construct(self):
        self.header("01", "一条公式，两个面积", "先看见同一块面积，再看符号怎样变形 · a=2，b=3，c=2")
        unit = 1.08
        left = Rectangle(width=3*unit, height=2*unit, stroke_color=CYAN, stroke_width=2.4, fill_color=CYAN, fill_opacity=0.16).move_to(np.array([-1.08, 0.48, 0]))
        right = Rectangle(width=2*unit, height=2*unit, stroke_color=ROSE, stroke_width=2.4, fill_color=ROSE, fill_opacity=0.16).next_to(left, RIGHT, buff=0)
        outer = SurroundingRectangle(VGroup(left,right), buff=0, stroke_color=INK, stroke_width=2.4)
        a_label = MathTex("a", color=GOLD, font_size=42).next_to(outer, LEFT, buff=0.24)
        b_label = MathTex("b", color=CYAN, font_size=42).next_to(left, UP, buff=0.18)
        c_label = MathTex("c", color=ROSE, font_size=42).next_to(right, UP, buff=0.18)
        lhs = MathTex("a", "(", "b", "+", "c", ")", font_size=54).move_to(np.array([-2.1,-1.85,0]))
        lhs[0].set_color(GOLD); lhs[2].set_color(CYAN); lhs[4].set_color(ROSE)
        equal = MathTex("=",font_size=54).next_to(lhs,RIGHT,buff=0.30)
        rhs = MathTex("a","b","+","a","c",font_size=54).next_to(equal,RIGHT,buff=0.30)
        for ix in (0,3): rhs[ix].set_color(GOLD)
        rhs[1].set_color(CYAN); rhs[4].set_color(ROSE)
        whole = VGroup(lhs,equal,rhs)
        whole.shift(LEFT*whole.get_center()[0])
        caption = self.footer("面积没变，变化的是我们读它的方式")
        self.play(Create(outer), FadeIn(a_label), Write(lhs), run_time=1.25)
        self.wait(0.55)
        self.play(FadeIn(left),FadeIn(right),FadeIn(b_label),FadeIn(c_label),run_time=1.15)
        self.play(FadeOut(outer), left.animate.shift(LEFT*.16),right.animate.shift(RIGHT*.16),b_label.animate.shift(LEFT*.16),c_label.animate.shift(RIGHT*.16),run_time=1.2)
        ab = MathTex("a","b",font_size=54).move_to(left)
        ac = MathTex("a","c",font_size=54).move_to(right)
        ab[0].set_color(GOLD);ab[1].set_color(CYAN);ac[0].set_color(GOLD);ac[1].set_color(ROSE)
        self.play(TransformFromCopy(a_label,ab[0]), TransformFromCopy(b_label,ab[1]),run_time=0.9)
        self.play(TransformFromCopy(a_label,ac[0]), TransformFromCopy(c_label,ac[1]),run_time=0.9)
        self.wait(0.4)
        # Explicit occurrence mapping prevents a many-to-one LaTeX matching error.
        self.play(Write(equal),TransformFromCopy(ab[0],rhs[0]),TransformFromCopy(ab[1],rhs[1]),run_time=1.0)
        self.play(Write(rhs[2]),TransformFromCopy(ac[0],rhs[3]),TransformFromCopy(ac[1],rhs[4]),run_time=1.0)
        self.play(Circumscribe(lhs[0],color=GOLD),Indicate(rhs[0],color=GOLD),Indicate(rhs[3],color=GOLD),run_time=1.2)
        # Unique tokens are safe for semantic matching; S and = retain identity.
        numeric = MathTex("S","=","6+4",font_size=35,color=MUTED).move_to(DOWN*2.65)
        result = MathTex("S","=","10",font_size=35,color=MINT).move_to(numeric)
        self.play(Write(numeric),FadeIn(caption),run_time=0.7)
        self.wait(0.6)
        self.play(TransformMatchingTex(numeric,result,transform_mismatches=True),run_time=1.1)
        self.wait(2.0)


class DerivativeLinkedView(StudyScene):
    """Secant geometry, triangle and readouts share h; finite h is never called exact derivative."""
    def construct(self):
        self.header("02","把平均变化，推近成瞬时变化","曲线、割线、数值共用同一个 Δx")
        axes = Axes(x_range=[0,2.7,.5],y_range=[0,6.5,1],x_length=6.4,y_length=4.25,axis_config={"color":MUTED,"include_tip":False},tips=False).move_to(np.array([-2.9,-.1,0]))
        curve = axes.plot(lambda x:x*x,x_range=[0,2.5],color=CYAN,stroke_width=3.5)
        curve_label = MathTex("f(x)=x^2",font_size=34,color=CYAN).move_to(np.array([-3.2,1.8,0]))
        h=ValueTracker(1.4)
        p=axes.c2p(1,1)
        base = Dot(p,color=GOLD,radius=.065)
        moving = always_redraw(lambda:Dot(axes.c2p(1+h.get_value(),(1+h.get_value())**2),color=ROSE,radius=.065))
        secant = always_redraw(lambda: Line(axes.c2p(1-1/(2+h.get_value()),0), axes.c2p(2.45,1+(2+h.get_value())*(2.45-1)),color=ROSE,stroke_width=2.8))
        horizontal = always_redraw(lambda:DashedLine(p,axes.c2p(1+h.get_value(),1),dash_length=.08,color=GOLD,stroke_width=2))
        vertical = always_redraw(lambda:DashedLine(axes.c2p(1+h.get_value(),1),axes.c2p(1+h.get_value(),(1+h.get_value())**2),dash_length=.08,color=ROSE,stroke_width=2))
        dx=MathTex(r"\Delta x",font_size=27,color=GOLD)
        dx.add_updater(lambda m:m.move_to((p+axes.c2p(1+h.get_value(),1))/2+DOWN*.27))
        formula = MathTex(r"\frac{(1+h)^2-1}{h}=2+h",font_size=38).move_to(np.array([3.75,1.35,0]))
        h_title=MathTex(r"h=\Delta x=",font_size=31,color=GOLD).move_to(np.array([3.4,.38,0]))
        h_number=DecimalNumber(1.4,num_decimal_places=2,font_size=40,color=GOLD).move_to(np.array([5.2,.38,0]))
        h_number.add_updater(lambda m:m.set_value(h.get_value()).move_to(np.array([5.2,.38,0])))
        slope_title=label("割线斜率",24,ROSE).move_to(np.array([3.4,-.42,0]))
        slope_number=DecimalNumber(3.4,num_decimal_places=2,font_size=40,color=ROSE).move_to(np.array([5.2,-.42,0]))
        slope_number.add_updater(lambda m:m.set_value(2+h.get_value()).move_to(np.array([5.2,-.42,0])))
        annotation=label("固定点 x = 1",21,GOLD).move_to(np.array([-4.6,-2.65,0]))
        self.play(Create(axes),Create(curve),Write(curve_label),run_time=1.5)
        self.play(FadeIn(base),FadeIn(moving),Create(secant),FadeIn(horizontal),FadeIn(vertical),FadeIn(dx),FadeIn(annotation),run_time=1)
        self.play(Write(formula),FadeIn(h_title),FadeIn(h_number),FadeIn(slope_title),FadeIn(slope_number),run_time=1)
        self.wait(.5)
        self.play(h.animate.set_value(.55),run_time=3.0,rate_func=smooth)
        self.wait(.5)
        self.play(h.animate.set_value(.08),run_time=3.0,rate_func=smooth)
        tangent=Line(axes.c2p(.5,0),axes.c2p(2.45,3.9),color=MINT,stroke_width=3)
        limit=MathTex(r"\lim_{h\to0}(2+h)=f^{\prime}(1)=2",font_size=35,color=MINT).move_to(np.array([3.75,-1.6,0]))
        self.play(Create(tangent),Write(limit),FadeIn(self.footer("粉色是有限间隔的割线；绿色是极限切线")),run_time=1.1)
        self.wait(2.4)


class MatrixBasisMap(StudyScene):
    """A matrix moves the plane and its basis by exactly the same map."""
    def construct(self):
        self.header("03","矩阵的两列，就是基向量的新家","M(t) = (1−t)I + tA · 浅灰网格保留起点，彩色基向量随 M(t) 改变")
        t=ValueTracker(0)
        A=np.array([[2.,1.],[1.,1.]])
        origin=np.array([-2.7,-.35,0])
        def pos(x,y):
            matrix=np.eye(2)*(1-t.get_value())+A*t.get_value()
            q=matrix@np.array([x,y])
            return origin+np.array([q[0],q[1],0])
        def grid():
            lines=VGroup()
            for s in np.linspace(-1.2,1.2,13):
                lines.add(Line(pos(s,-1.2),pos(s,1.2),color=GRID,stroke_width=1))
                lines.add(Line(pos(-1.2,s),pos(1.2,s),color=GRID,stroke_width=1))
            return lines
        reference_grid=grid().set_stroke(color="#718096",width=.8,opacity=.28)
        reference_origin=Dot(origin,color=MUTED,radius=.03)
        reference_label=MathTex("O",font_size=21,color=MUTED).next_to(origin,DOWN+LEFT,buff=.12)
        self.add(reference_grid,reference_origin,reference_label)
        plane=always_redraw(grid)
        cell=always_redraw(lambda:Polygon(pos(0,0),pos(1,0),pos(1,1),pos(0,1),stroke_color=MINT,stroke_width=1.5,fill_color=MINT,fill_opacity=.13))
        e1=always_redraw(lambda:Arrow(pos(0,0),pos(1,0),buff=0,color=CYAN,stroke_width=5,max_tip_length_to_length_ratio=.14))
        e2=always_redraw(lambda:Arrow(pos(0,0),pos(0,1),buff=0,color=ROSE,stroke_width=5,max_tip_length_to_length_ratio=.14))
        v=always_redraw(lambda:Dot(pos(1,1),color=INK,radius=.065))
        e1_tag=MathTex(r"M(t)\hat e_1",font_size=25,color=CYAN)
        e1_tag.add_updater(lambda m:m.next_to(pos(1,0),DOWN+RIGHT,buff=.10))
        e2_tag=MathTex(r"M(t)\hat e_2",font_size=25,color=ROSE)
        e2_tag.add_updater(lambda m:m.next_to(pos(0,1),UP+LEFT,buff=.10))
        v_tag=MathTex("v",font_size=30,color=INK)
        v_tag.add_updater(lambda m:m.next_to(pos(1,1),UP+RIGHT,buff=.12))
        matrix = Matrix([[2,1],[1,1]],element_to_mobject_config={"font_size":41}).move_to(np.array([4.4,1.05,0]))
        matrix.get_columns()[0].set_color(CYAN);matrix.get_columns()[1].set_color(ROSE)
        matrix_title=MathTex("A=",font_size=42).next_to(matrix,LEFT,buff=.25)
        first=MathTex(r"A\hat e_1=\begin{bmatrix}2\\1\end{bmatrix}",font_size=34,color=CYAN).move_to(np.array([3.5,-.3,0]))
        second=MathTex(r"A\hat e_2=\begin{bmatrix}1\\1\end{bmatrix}",font_size=34,color=ROSE).move_to(np.array([5.35,-.3,0]))
        v_formula=MathTex(r"A\begin{bmatrix}1\\1\end{bmatrix}=\begin{bmatrix}3\\2\end{bmatrix}",font_size=34).move_to(np.array([4.4,-1.75,0]))
        self.play(FadeIn(plane),FadeIn(cell),GrowArrow(e1),GrowArrow(e2),FadeIn(v),FadeIn(e1_tag),FadeIn(e2_tag),FadeIn(v_tag),run_time=1.4)
        self.play(Write(matrix),Write(matrix_title),run_time=1.0)
        self.wait(.7)
        self.play(t.animate.set_value(.45),run_time=2.7,rate_func=smooth)
        self.wait(.5)
        self.play(t.animate.set_value(1),run_time=3.3,rate_func=smooth)
        self.play(Write(first),Write(second),run_time=1.0)
        self.play(Write(v_formula),FadeIn(self.footer("同一个变换作用于基向量、网格和每一个点")),run_time=1.1)
        det=MathTex(r"\det A=1\quad\Rightarrow\quad\mathrm{area}=1",font_size=29,color=MINT).move_to(np.array([-2.6,-2.85,0]))
        self.play(Write(det),run_time=.7)
        self.wait(2.0)


class ComplexRotationProjection(StudyScene):
    """Circle, phasor, trace and readouts share theta; no decorative fake curve."""
    def construct(self):
        self.header("04","一个旋转，生长出一条正弦波","左边读角度，右边读同一个点的高度")
        center=np.array([-3.9,-.05,0]); radius=1.55
        theta=ValueTracker(0)
        circle=Circle(radius=radius,color=GRID,stroke_width=2).move_to(center)
        caxes=VGroup(Line(center+LEFT*1.9,center+RIGHT*1.9,color=GRID),Line(center+DOWN*1.9,center+UP*1.9,color=GRID))
        start=np.array([-.85,-.05,0]); sx=1.03
        def wavepos(x): return start+np.array([sx*x,radius*np.sin(x),0])
        def point(): return center+radius*np.array([np.cos(theta.get_value()),np.sin(theta.get_value()),0])
        waxes=VGroup(Line(start+LEFT*.1,start+RIGHT*(TAU*sx+.2),color=MUTED,stroke_width=1.5),Line(start+DOWN*1.8,start+UP*1.8,color=GRID,stroke_width=1.3))
        baseline=ParametricFunction(lambda x:wavepos(x),t_range=[0,TAU,.025],color=GRID,stroke_width=2)
        ticks=VGroup(*[VGroup(Line(wavepos(a)+DOWN*.06,wavepos(a)+UP*.06,color=MUTED),MathTex(tex,font_size=25,color=MUTED).move_to(start+RIGHT*a*sx+DOWN*1.97)) for a,tex in [(0,"0"),(PI,r"\pi"),(TAU,r"2\pi")]])
        arm=always_redraw(lambda:Arrow(center,point(),buff=0,color=ROSE,stroke_width=4,max_tip_length_to_length_ratio=.12))
        dot=always_redraw(lambda:Dot(point(),color=ROSE,radius=.065))
        endpoint=always_redraw(lambda:Dot(wavepos(theta.get_value()),color=CYAN,radius=.065))
        connector=always_redraw(lambda:DashedLine(point(),wavepos(theta.get_value()),color=CYAN,stroke_width=1.6,dash_length=.09))
        curve=always_redraw(lambda:ParametricFunction(lambda x:wavepos(x),t_range=[0,max(theta.get_value(),.001),.025],color=CYAN,stroke_width=3.5))
        formula=MathTex(r"e^{i\theta}=\cos\theta+i\sin\theta",font_size=35).move_to(np.array([2.2,1.95,0]))
        angle=Arc(radius=.42,start_angle=0,angle=.001,color=GOLD).move_arc_center_to(center)
        angle.add_updater(lambda m:m.become(Arc(radius=.42,start_angle=0,angle=max(theta.get_value(),.001),color=GOLD).move_arc_center_to(center)))
        tl=MathTex(r"\theta=",font_size=31,color=ROSE).move_to(np.array([-4.7,-2.65,0]))
        tn=DecimalNumber(0,num_decimal_places=2,font_size=34,color=ROSE).move_to(np.array([-3.5,-2.65,0]));tn.add_updater(lambda m:m.set_value(theta.get_value()).move_to(np.array([-3.5,-2.65,0])))
        sl=MathTex(r"\sin\theta=",font_size=31,color=CYAN).move_to(np.array([2.3,-2.65,0]))
        sn=DecimalNumber(0,num_decimal_places=2,include_sign=True,font_size=34,color=CYAN).move_to(np.array([4.0,-2.65,0]));sn.add_updater(lambda m:m.set_value(np.sin(theta.get_value())).move_to(np.array([4.0,-2.65,0])))
        self.play(Create(circle),Create(caxes),Create(waxes),Create(baseline),FadeIn(ticks),run_time=1.3)
        self.play(FadeIn(arm),FadeIn(dot),FadeIn(endpoint),FadeIn(connector),Write(formula),FadeIn(tl),FadeIn(tn),FadeIn(sl),FadeIn(sn),run_time=1)
        self.add(curve,angle)
        self.wait(.4)
        self.play(theta.animate.set_value(TAU),run_time=9,rate_func=linear)
        self.play(FadeIn(self.footer("正弦不是另一段动画，它就是旋转点的竖直投影")),run_time=.6)
        self.wait(2.0)
